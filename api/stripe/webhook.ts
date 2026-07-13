import { Timestamp } from "firebase-admin/firestore";
import { isExpectedStoredCheckout } from "../_lib/commerce";
import { environment } from "../_lib/env";
import { firestore } from "../_lib/firebase";
import { json, methodNotAllowed, readRaw, type ApiRequest, type ApiResponse } from "../_lib/http";
import { paidReportForStoredSession } from "../_lib/report";
import { isUnexpired, type StoredDiagnosisResult } from "../_lib/result";
import { stripe } from "../_lib/stripe";

export const config = { api: { bodyParser: false } };

const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const REPORT_ACCESS_MS = 180 * 24 * 60 * 60 * 1000;
const ANSWER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FEEDBACK_RETENTION_MS = 730 * 24 * 60 * 60 * 1000;

function resultIdFromSession(session: { metadata?: Record<string, string> | null }): string | undefined {
  const value = session.metadata?.resultId;
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response);
  let event;
  try { event = stripe().webhooks.constructEvent(await readRaw(request), request.headers["stripe-signature"] ?? "", environment("STRIPE_WEBHOOK_SECRET")); }
  catch { return json(response, 400, { error: "Webhook verification failed" }); }
  if (event.type !== "checkout.session.completed") return json(response, 200, { received: true });
  const checkout = event.data.object;
  const resultId = resultIdFromSession(checkout);
  if (!resultId || checkout.payment_status !== "paid") return json(response, 200, { received: true });

  const db = firestore();
  const resultReference = db.collection("diagnosisResults").doc(resultId);
  const eventReference = db.collection("stripeEvents").doc(event.id);
  let stored: StoredDiagnosisResult | undefined;
  try {
    const lineItems = await stripe().checkout.sessions.listLineItems(checkout.id, { limit: 2 });
    const priceIds = lineItems.data.map((item) => typeof item.price === "string" ? item.price : item.price?.id).filter((id): id is string => Boolean(id));
    const acquired = await db.runTransaction(async (transaction) => {
      const [eventSnapshot, resultSnapshot] = await Promise.all([transaction.get(eventReference), transaction.get(resultReference)]);
      if (eventSnapshot.exists && eventSnapshot.get("processedAt")) return { kind: "complete" as const };
      const eventLeaseActive = eventSnapshot.exists && eventSnapshot.get("leaseExpiresAt")?.toMillis?.() > Date.now();
      if (eventLeaseActive) return { kind: "busy" as const };
      if (!resultSnapshot.exists) throw new Error("Result not found");
      const result = resultSnapshot.data() as StoredDiagnosisResult;
      if (result.status === "paid") {
        transaction.set(eventReference, { kind: event.type, checkoutSessionId: checkout.id, processedAt: Timestamp.now() }, { merge: true });
        return { kind: "complete" as const };
      }
      const resultLeaseActive = result.status === "generation-pending" && Boolean(result.fulfillmentLeaseExpiresAt) && result.fulfillmentLeaseExpiresAt!.toMillis() > Date.now();
      if (resultLeaseActive) return { kind: "busy" as const };
      if ((result.status !== "awaiting-payment" && result.status !== "generation-pending") || !isUnexpired(result) || result.stripeCheckoutSessionId !== checkout.id || !result.expectedPriceId || result.expectedAmount == null || !result.expectedCurrency) throw new Error("Checkout does not match result");
      if (!isExpectedStoredCheckout(checkout, priceIds, { priceId: result.expectedPriceId, amount: result.expectedAmount, currency: result.expectedCurrency })) throw new Error("Unexpected Checkout payment");
      const leaseExpiresAt = Timestamp.fromMillis(Date.now() + PROCESSING_LEASE_MS);
      transaction.set(eventReference, { kind: event.type, checkoutSessionId: checkout.id, status: "processing", leaseExpiresAt }, { merge: true });
      transaction.update(resultReference, { status: "generation-pending", fulfillmentEventId: event.id, fulfillmentLeaseExpiresAt: leaseExpiresAt });
      return { kind: "acquired" as const, result };
    });
    if (acquired.kind !== "acquired") return json(response, 200, { received: true });
    stored = acquired.result;
  } catch {
    return json(response, 500, { error: "Webhook processing failed" });
  }

  const paidAt = Timestamp.now();
  const expiryFields = {
    paidAt,
    expiresAt: Timestamp.fromMillis(paidAt.toMillis() + REPORT_ACCESS_MS),
    answerDataExpiresAt: Timestamp.fromMillis(paidAt.toMillis() + ANSWER_RETENTION_MS),
    feedbackExpiresAt: Timestamp.fromMillis(paidAt.toMillis() + FEEDBACK_RETENTION_MS),
  };
  let report;
  try { report = paidReportForStoredSession(stored.diagnosisSnapshot); }
  catch {
    try {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(resultReference);
        if (!current.exists || current.get("fulfillmentEventId") !== event.id) throw new Error("Fulfillment lease changed");
        transaction.update(resultReference, { status: "generation-failed", stripePaymentIntentId: typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id, ...expiryFields });
        transaction.set(eventReference, { status: "processed", processedAt: Timestamp.now() }, { merge: true });
      });
      return json(response, 200, { received: true });
    } catch { return json(response, 500, { error: "Webhook processing failed" }); }
  }

  try {
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(resultReference);
      if (!current.exists || current.get("fulfillmentEventId") !== event.id) throw new Error("Fulfillment lease changed");
      transaction.update(resultReference, { status: "paid", stripePaymentIntentId: typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id, paidReport: report, ...expiryFields });
      transaction.set(eventReference, { status: "processed", processedAt: Timestamp.now() }, { merge: true });
    });
    return json(response, 200, { received: true });
  } catch { return json(response, 500, { error: "Webhook processing failed" }); }
}
