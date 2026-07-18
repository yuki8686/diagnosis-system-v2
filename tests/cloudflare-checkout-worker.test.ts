import { createHmac } from "node:crypto";
import { strict as assert } from "node:assert";
import { handleRequest } from "../worker";
import type { CheckoutDependencies } from "../worker/checkout";
import type { Env } from "../worker/env";
import { CheckoutRejectedError, matchesAccessTokenHash, type CheckoutInput, type CheckoutReservation, type CheckoutStore, type ExpectedCheckout } from "../worker/firestore";
import type { StripeCheckoutGateway } from "../worker/stripe";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";

const resultId = "11111111-1111-4111-8111-111111111111";
const accessToken = "a".repeat(43);

const assets: Fetcher = {
  async fetch(): Promise<Response> {
    return new Response("<html>SPA</html>");
  },
  connect(): never {
    throw new Error("ASSETS.connect must not be called");
  },
};

function completeEnv(overrides: Omit<Partial<Env>, "ASSETS"> = {}): Env {
  return {
    ASSETS: assets,
    STRIPE_SALE_PRICE_MODE: "launch",
    STRIPE_SECRET_KEY: "sk_test_not-a-real-secret",
    STRIPE_WEBHOOK_SECRET: "whsec_not-a-real-secret",
    STRIPE_LAUNCH_PRICE_ID: "price_launch_980",
    STRIPE_REGULAR_PRICE_ID: "price_regular_1980",
    PUBLIC_APP_URL: "https://diagnosis.example.test",
    FIREBASE_PROJECT_ID: "test-project",
    FIREBASE_CLIENT_EMAIL: "server@example.test",
    FIREBASE_PRIVATE_KEY: "not-a-real-private-key",
    REPORT_ACCESS_TOKEN_SECRET: "x".repeat(32),
    LEGAL_SELLER_NAME: "seller",
    LEGAL_RESPONSIBLE_PERSON: "responsible",
    LEGAL_ADDRESS: "address",
    LEGAL_PHONE: "phone",
    LEGAL_CONTACT_EMAIL: PUBLIC_SALES_CONFIG.contactEmail,
    LEGAL_SUPPORT_HOURS: "hours",
    LEGAL_EFFECTIVE_DATE: "2026-07-18",
    SERVICE_NAME: PUBLIC_SALES_CONFIG.diagnosisName,
    DIAGNOSIS_NAME: PUBLIC_SALES_CONFIG.diagnosisName,
    PAID_PRODUCT_NAME: PUBLIC_SALES_CONFIG.paidProductName,
    MAIN_TYPE_NAMES: "main names",
    SUBTYPE_NAMES: "subtype names",
    ...overrides,
  };
}

type StoreCondition = "valid" | "token-mismatch" | "missing" | "expired" | "wrong-status" | "lease-active";

class FakeCheckoutStore implements CheckoutStore {
  readonly calls: string[] = [];
  savedSessionId: string | undefined;
  expected: ExpectedCheckout | undefined;

  constructor(private readonly condition: StoreCondition = "valid") {}

  async reserve(input: CheckoutInput, expected: ExpectedCheckout): Promise<CheckoutReservation> {
    this.calls.push("reserve");
    this.expected = expected;
    if (this.condition !== "valid" || input.accessToken !== accessToken || input.resultId !== resultId) throw new CheckoutRejectedError();
    return { documentName: `projects/test-project/databases/(default)/documents/diagnosisResults/${resultId}` };
  }

  async saveCheckoutSession(_reservation: CheckoutReservation, sessionId: string): Promise<void> {
    this.calls.push("save");
    this.savedSessionId = sessionId;
  }

  async markCheckoutFailed(_reservation: CheckoutReservation): Promise<void> {
    this.calls.push("failed");
  }
}

class FakeStripeGateway implements StripeCheckoutGateway {
  readonly calls: string[] = [];
  expected: ExpectedCheckout | undefined;

  constructor(private readonly shouldFail = false) {}

  async verifyActivePrice(expected: ExpectedCheckout): Promise<void> {
    this.calls.push("verify");
    this.expected = expected;
  }

  async createCheckoutSession(_input: CheckoutInput, expected: ExpectedCheckout): Promise<{ id: string; url: string }> {
    this.calls.push("create");
    this.expected = expected;
    if (this.shouldFail) throw new Error("Stripe test failure containing sk_test_not-a-real-secret");
    return { id: "cs_test_checkout", url: "https://checkout.stripe.com/c/pay/cs_test_checkout" };
  }
}

function testDependencies(condition: StoreCondition = "valid", stripeFails = false): { dependencies: CheckoutDependencies; store: FakeCheckoutStore; stripe: FakeStripeGateway } {
  const store = new FakeCheckoutStore(condition);
  const stripe = new FakeStripeGateway(stripeFails);
  return { dependencies: { store, stripe }, store, stripe };
}

function checkoutRequest(body: BodyInit = JSON.stringify({ resultId, accessToken })): Request {
  return new Request("https://worker.example.test/api/checkout", { method: "POST", body, headers: { "Content-Type": "application/json" } });
}

const hash = createHmac("sha256", "x".repeat(32)).update(accessToken).digest("hex");
assert.equal(await matchesAccessTokenHash(accessToken, hash, "x".repeat(32)), true, "Worker ownership proof uses the existing HMAC-SHA256 representation");
assert.equal(await matchesAccessTokenHash(`${accessToken.slice(0, -1)}b`, hash, "x".repeat(32)), false, "ownership proof rejects a mismatched access token");

const normal = testDependencies();
const normalResponse = await handleRequest(checkoutRequest(), completeEnv(), { checkout: normal.dependencies });
assert.equal(normalResponse.status, 200, "a valid owner can create Checkout");
assert.deepEqual(await normalResponse.json(), { checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_checkout" });
assert.deepEqual(normal.store.calls, ["reserve", "save"], "reservation is written before the Session ID and remains created on success");
assert.deepEqual(normal.stripe.calls, ["verify", "create"], "a successful checkout verifies the active Stripe Price before creating the Session");
assert.equal(normal.store.savedSessionId, "cs_test_checkout", "Stripe Session ID is persisted after creation");
assert.deepEqual(normal.store.expected, { priceId: "price_launch_980", amount: 980, currency: "jpy" }, "launch mode uses the active launch Price ID and configured amount");

const regular = testDependencies();
const regularResponse = await handleRequest(checkoutRequest(), completeEnv({ STRIPE_SALE_PRICE_MODE: "regular" }), { checkout: regular.dependencies });
assert.equal(regularResponse.status, 200, "regular mode creates Checkout");
assert.deepEqual(regular.store.expected, { priceId: "price_regular_1980", amount: 1980, currency: "jpy" }, "regular mode uses the active regular Price ID and configured amount");

const wrongToken = testDependencies();
const wrongTokenResponse = await handleRequest(checkoutRequest(JSON.stringify({ resultId, accessToken: "b".repeat(43) })), completeEnv(), { checkout: wrongToken.dependencies });
assert.equal(wrongTokenResponse.status, 500, "a mismatched access token is rejected without revealing ownership state");
assert.deepEqual(wrongToken.stripe.calls, [], "a mismatched access token never reaches Stripe");

for (const condition of ["missing", "expired", "wrong-status", "lease-active"] as const) {
  const rejected = testDependencies(condition);
  const response = await handleRequest(checkoutRequest(), completeEnv(), { checkout: rejected.dependencies });
  assert.equal(response.status, 500, `${condition} is rejected without revealing which Firestore check failed`);
  assert.deepEqual(rejected.stripe.calls, [], `${condition} never reaches Stripe`);
}

const failedStripe = testDependencies("valid", true);
const failedStripeResponse = await handleRequest(checkoutRequest(), completeEnv(), { checkout: failedStripe.dependencies });
assert.equal(failedStripeResponse.status, 500, "Stripe failures do not expose a successful Checkout response");
assert.deepEqual(failedStripe.store.calls, ["reserve", "failed"], "Stripe failure releases the checkout creation lease");
assert.equal((await failedStripeResponse.json() as { error: string }).error.includes("sk_test_not-a-real-secret"), false, "Stripe errors are not exposed to the client");

const malformed = await handleRequest(checkoutRequest("{"), completeEnv(), { checkout: testDependencies().dependencies });
assert.equal(malformed.status, 500, "malformed JSON preserves the existing generic checkout failure response");
const missingField = await handleRequest(checkoutRequest(JSON.stringify({ resultId })), completeEnv(), { checkout: testDependencies().dependencies });
assert.equal(missingField.status, 400, "missing required checkout input returns 400");
const tooLarge = await handleRequest(checkoutRequest("x".repeat(4_097)), completeEnv(), { checkout: testDependencies().dependencies });
assert.equal(tooLarge.status, 500, "oversized request bodies are rejected before a Checkout reservation");

const unavailable = testDependencies();
const unavailableResponse = await handleRequest(checkoutRequest(), completeEnv({ STRIPE_SECRET_KEY: "" }), { checkout: unavailable.dependencies });
assert.equal(unavailableResponse.status, 503, "incomplete purchase configuration fails closed");
assert.deepEqual(unavailable.stripe.calls, [], "incomplete configuration does not call Stripe");
assert.deepEqual(await unavailableResponse.json(), {
  code: "purchase_unavailable",
  error: "有料レポートは現在準備中です。販売開始までお待ちください。",
  purchaseAvailable: false,
  purchaseStatus: "preparing",
}, "checkout uses the same public unavailable contract as /api/offer");

const methodResponse = await handleRequest(new Request("https://worker.example.test/api/checkout"), completeEnv());
assert.equal(methodResponse.status, 405, "non-POST checkout methods are rejected");
assert.equal(methodResponse.headers.get("Allow"), "POST", "checkout 405 responses declare POST");

console.log("Cloudflare checkout Worker ownership, lease, Stripe, and fail-closed tests passed");
