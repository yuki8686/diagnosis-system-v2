import type { Env } from "./env";
import { createFirestoreWebhookStore, type WebhookCheckout, type WebhookStore } from "./firestore";
import { createStripeWebhookGateway, type StripeWebhookGateway } from "./stripe";

const MAX_WEBHOOK_BYTES = 1_000_000;
const SIGNATURE_TOLERANCE_SECONDS = 300;

interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface WebhookDependencies {
  store: WebhookStore;
  stripe: StripeWebhookGateway;
  now: () => number;
}

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hexBytes(value: string): Uint8Array | undefined {
  if (!/^[0-9a-f]{64}$/iu.test(value)) return undefined;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function signatureParts(header: string): { timestamp: number; signatures: Uint8Array[] } | undefined {
  const timestampPart = header.split(",").find((part) => part.startsWith("t="));
  const timestamp = timestampPart ? Number(timestampPart.slice(2)) : Number.NaN;
  const signatures = header.split(",").flatMap((part) => part.startsWith("v1=") ? [hexBytes(part.slice(3))] : []).filter((value): value is Uint8Array => Boolean(value));
  return Number.isSafeInteger(timestamp) && signatures.length ? { timestamp, signatures } : undefined;
}

async function readRawBody(request: Request): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) throw new Error("body-too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body-missing");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_WEBHOOK_BYTES) { await reader.cancel(); throw new Error("body-too-large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function verifyStripeSignature(rawBody: Uint8Array, header: string | null, secret: string, now: number): Promise<boolean> {
  if (!header) return false;
  const parts = signatureParts(header);
  if (!parts || Math.abs(Math.floor(now / 1000) - parts.timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const prefix = new TextEncoder().encode(`${parts.timestamp}.`);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix);
  signed.set(rawBody, prefix.length);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  return parts.signatures.some((signature) => timingSafeEqual(digest, signature));
}

function webhookCheckout(event: StripeEvent, priceIds: string[]): WebhookCheckout | undefined {
  if (!isRecord(event.data.object)) return undefined;
  const checkout = event.data.object;
  const metadata = isRecord(checkout.metadata) ? checkout.metadata : undefined;
  const resultId = metadata?.resultId;
  if (typeof checkout.id !== "string" || typeof resultId !== "string" || !/^[0-9a-f-]{36}$/iu.test(resultId)
    || typeof checkout.payment_status !== "string" || typeof checkout.mode !== "string" || typeof checkout.currency !== "string" || typeof checkout.amount_total !== "number") return undefined;
  const paymentIntent = typeof checkout.payment_intent === "string" ? checkout.payment_intent : isRecord(checkout.payment_intent) && typeof checkout.payment_intent.id === "string" ? checkout.payment_intent.id : undefined;
  return { eventId: event.id, eventType: event.type, checkoutSessionId: checkout.id, resultId, ...(paymentIntent ? { paymentIntentId: paymentIntent } : {}), paymentStatus: checkout.payment_status, mode: checkout.mode, currency: checkout.currency, amountTotal: checkout.amount_total, priceIds };
}

function runtimeDependencies(env: Env): WebhookDependencies {
  return { store: createFirestoreWebhookStore(env), stripe: createStripeWebhookGateway(env), now: Date.now };
}

export async function webhookResponse(request: Request, env: Env, dependencies?: WebhookDependencies): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return jsonResponse(503, { error: "Webhook processing unavailable" });
  const now = dependencies?.now ?? Date.now;
  let rawBody: Uint8Array;
  try { rawBody = await readRawBody(request); }
  catch { return jsonResponse(400, { error: "Webhook verification failed" }); }
  try {
    if (!await verifyStripeSignature(rawBody, request.headers.get("Stripe-Signature"), secret, now())) return jsonResponse(400, { error: "Webhook verification failed" });
  } catch { return jsonResponse(400, { error: "Webhook verification failed" }); }
  let event: StripeEvent;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    if (!isRecord(parsed) || typeof parsed.id !== "string" || typeof parsed.type !== "string" || !isRecord(parsed.data) || !("object" in parsed.data)) throw new Error("invalid-event");
    event = { id: parsed.id, type: parsed.type, data: { object: parsed.data.object } };
  } catch { return jsonResponse(400, { error: "Webhook verification failed" }); }
  if (event.type !== "checkout.session.completed") return jsonResponse(200, { received: true });
  try {
    const activeDependencies = dependencies ?? runtimeDependencies(env);
    const tentative = webhookCheckout(event, []);
    if (!tentative || tentative.paymentStatus !== "paid" || tentative.mode !== "payment") return jsonResponse(200, { received: true });
    const priceIds = await activeDependencies.stripe.lineItemPriceIds(tentative.checkoutSessionId);
    const checkout = webhookCheckout(event, priceIds);
    if (!checkout) return jsonResponse(200, { received: true });
    await activeDependencies.store.settle(checkout);
    return jsonResponse(200, { received: true });
  } catch { return jsonResponse(500, { error: "Webhook processing failed" }); }
}
