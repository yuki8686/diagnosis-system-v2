import { ACTIVE_OFFER, isExpectedActivePrice } from "./_lib/commerce";
import { checkoutRequest } from "./_lib/checkout";
import { isProductionEnvironment, publicAppUrl, purchaseConfigurationIsComplete } from "./_lib/env";
import { firestore } from "./_lib/firebase";
import { json, methodNotAllowed, readJson, type ApiRequest, type ApiResponse } from "./_lib/http";
import { purchaseUnavailableResponse } from "./_lib/purchase-availability";
import { isUnexpired, type StoredDiagnosisResult } from "./_lib/result";
import { stripe } from "./_lib/stripe";
import { matchesAccessTokenHash } from "./_lib/token";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response);
  if (!purchaseConfigurationIsComplete()) return json(response, 503, purchaseUnavailableResponse(), { "Cache-Control": "no-store" });
  let reservedReference: DocumentReference | undefined;
  try {
    const input = checkoutRequest(await readJson(request, 4_096));
    if (!input) return json(response, 400, { error: "購入対象を確認できませんでした。" });
    const db = firestore();
    const reference = db.collection("diagnosisResults").doc(input.resultId);
    const expected = { priceId: ACTIVE_OFFER.priceId(), amount: ACTIVE_OFFER.amount(), currency: ACTIVE_OFFER.currency };
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("checkout-rejected");
      const result = snapshot.data() as StoredDiagnosisResult;
      const creationLeaseActive = result.checkoutCreationState === "creating" && Boolean(result.checkoutCreationStartedAt) && result.checkoutCreationStartedAt!.toMillis() > Date.now() - 5 * 60 * 1000;
      if (!matchesAccessTokenHash(input.accessToken, result.accessTokenHash) || result.status !== "awaiting-payment" || !isUnexpired(result) || creationLeaseActive || Boolean(result.stripeCheckoutSessionId)) throw new Error("checkout-rejected");
      transaction.update(reference, { checkoutCreationState: "creating", checkoutCreationStartedAt: Timestamp.now(), expectedPriceId: expected.priceId, expectedAmount: expected.amount, expectedCurrency: expected.currency });
    });
    reservedReference = reference;
    const price = await stripe().prices.retrieve(ACTIVE_OFFER.priceId(), { expand: ["product"] });
    const productName = typeof price.product === "object" && price.product && "name" in price.product ? price.product.name : undefined;
    if (!isExpectedActivePrice(price) || (isProductionEnvironment() && productName !== process.env.PAID_PRODUCT_NAME)) throw new Error("Stripe Price configuration mismatch");
    const appUrl = publicAppUrl();
    const checkout = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: expected.priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&resultId=${encodeURIComponent(input.resultId)}`,
      cancel_url: `${appUrl}/?checkout=cancelled&resultId=${encodeURIComponent(input.resultId)}`,
      metadata: { resultId: input.resultId },
    });
    if (!checkout.url) throw new Error("Stripe Checkout URL missing");
    const checkoutUrl = new URL(checkout.url);
    if (checkoutUrl.protocol !== "https:" || !(checkoutUrl.hostname === "checkout.stripe.com" || checkoutUrl.hostname.endsWith(".stripe.com"))) throw new Error("Unexpected Stripe Checkout URL");
    await reference.update({ stripeCheckoutSessionId: checkout.id, checkoutCreationState: "created" });
    return json(response, 200, { checkoutUrl: checkout.url });
  } catch {
    if (reservedReference) await reservedReference.update({ checkoutCreationState: "failed" }).catch(() => undefined);
    return json(response, 500, { error: "購入手続きを開始できませんでした。時間をおいてもう一度お試しください。" });
  }
}
