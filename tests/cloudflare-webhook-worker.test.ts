import { strict as assert } from "node:assert";
import { handleRequest } from "../worker";
import type { Env } from "../worker/env";
import type { WebhookCheckout, WebhookStore } from "../worker/firestore";
import type { StripeWebhookGateway } from "../worker/stripe";
import type { WebhookDependencies } from "../worker/webhook";

const NOW = Date.parse("2026-07-18T00:00:00.000Z");
const SECRET = "whsec_test_only_not_a_real_secret";
const resultId = "11111111-1111-4111-8111-111111111111";

const assets: Fetcher = { async fetch(): Promise<Response> { return new Response("SPA"); }, connect(): never { throw new Error("unused"); } };
function env(overrides: Omit<Partial<Env>, "ASSETS"> = {}): Env { return { ASSETS: assets, STRIPE_WEBHOOK_SECRET: SECRET, ...overrides }; }

async function signature(body: string, timestamp = Math.floor(NOW / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
  return `t=${timestamp},v1=${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function event(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ id: "evt_test_1", type: "checkout.session.completed", data: { object: { id: "cs_test_1", payment_status: "paid", mode: "payment", currency: "jpy", amount_total: 980, metadata: { resultId }, payment_intent: "pi_test_1", ...overrides } } });
}

class Store implements WebhookStore {
  checkout: WebhookCheckout | undefined;
  completes = 0;
  failures = 0;
  constructor(private readonly failure = false) {}
  async acquire(checkout: WebhookCheckout): Promise<{ kind: "complete" | "busy" }> {
    if (this.failure) throw new Error("FIREBASE_PRIVATE_KEY must not be exposed");
    this.checkout = checkout;
    return { kind: "complete" };
  }
  async complete(_checkout: WebhookCheckout, _paidReport: unknown): Promise<void> { this.completes += 1; }
  async fail(_checkout: WebhookCheckout): Promise<void> { this.failures += 1; }
}
class Stripe implements StripeWebhookGateway {
  calls = 0;
  constructor(private readonly ids = ["price_launch_980"]) {}
  async lineItemPriceIds(_checkoutSessionId: string): Promise<string[]> { this.calls += 1; return this.ids; }
}
function dependencies(store = new Store(), stripe = new Stripe()): { values: WebhookDependencies; store: Store; stripe: Stripe } {
  return { values: { store, stripe, now: () => NOW }, store, stripe };
}
async function webhookRequest(body: string, header?: string): Promise<Request> {
  return new Request("https://worker.example.test/api/webhook", { method: "POST", headers: { "Stripe-Signature": header ?? await signature(body) }, body });
}

const normal = dependencies();
const body = event();
const normalResponse = await handleRequest(await webhookRequest(body), env(), { webhook: normal.values });
assert.equal(normalResponse.status, 200, "valid signed Checkout completion is accepted");
assert.equal(normal.store.checkout?.resultId, resultId);
assert.equal(normal.store.checkout?.mode, "payment");
assert.deepEqual(normal.store.checkout?.priceIds, ["price_launch_980"], "line-item Price IDs are passed to the transactional store");

const invalidSignature = await handleRequest(await webhookRequest(body, "t=1784332800,v1=00"), env(), { webhook: dependencies().values });
assert.equal(invalidSignature.status, 400, "invalid signatures are rejected");
const expiredSignature = await handleRequest(await webhookRequest(body, await signature(body, Math.floor(NOW / 1000) - 301)), env(), { webhook: dependencies().values });
assert.equal(expiredSignature.status, 400, "expired signatures are rejected");
const multiSignature = await handleRequest(await webhookRequest(body, `t=${Math.floor(NOW / 1000)},v1=${"0".repeat(64)},${(await signature(body)).split(",")[1]}`), env(), { webhook: dependencies().values });
assert.equal(multiSignature.status, 200, "any valid v1 signature succeeds during secret rotation");

for (const [name, payload] of [["payment", event({ payment_status: "unpaid" })], ["mode", event({ mode: "subscription" })], ["metadata", event({ metadata: { resultId: "bad" } })]] as const) {
  const target = dependencies();
  const response = await handleRequest(await webhookRequest(payload), env(), { webhook: target.values });
  assert.equal(response.status, 200, `${name} mismatch is safely ignored`);
  assert.equal(target.stripe.calls, 0, `${name} mismatch does not call Stripe`);
}

const unsupportedBody = JSON.stringify({ id: "evt_other", type: "customer.created", data: { object: {} } });
assert.equal((await handleRequest(await webhookRequest(unsupportedBody), env(), { webhook: dependencies().values })).status, 200, "unsupported signed events are acknowledged");
const failing = dependencies(new Store(true));
const failedResponse = await handleRequest(await webhookRequest(body), env(), { webhook: failing.values });
assert.equal(failedResponse.status, 500, "temporary storage failures remain retryable");
assert.equal(JSON.stringify(await failedResponse.json()).includes("FIREBASE_PRIVATE_KEY"), false, "storage errors do not expose secrets");
assert.equal((await handleRequest(new Request("https://worker.example.test/api/webhook"), env())).status, 405, "non-POST webhook methods are rejected");
assert.equal((await handleRequest(new Request("https://worker.example.test/api/webhook", { method: "POST", body: "x".repeat(1_000_001) }), env())).status, 400, "oversized bodies are rejected before parsing");

console.log("Cloudflare webhook signature, event filtering, and retry tests passed");
