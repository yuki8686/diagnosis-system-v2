import { strict as assert } from "node:assert";
import { flattenQuestionBank } from "../src/data/question-bank-contract";
import { questionBank } from "../src/data/question-bank";
import { buildDiagnosisRoute } from "../src/routing";
import { newSession } from "../src/ui/session";
import type { DiagnosisSession } from "../src/ui/session";
import type { AnswerRecord, DiagnosisRoute, TypeId, TypeResolution } from "../src/types";
import { handleRequest } from "../worker";
import type { CheckoutDependencies } from "../worker/checkout";
import type { Env } from "../worker/env";
import {
  CheckoutRejectedError,
  type CheckoutInput,
  type CheckoutReservation,
  type CheckoutStore,
  type ExpectedCheckout,
  type PaidReportRecord,
  type PaidReportStore,
  type PurchaseStatus,
  type PurchaseStatusStore,
  type ResultSeed,
  type ResultStore,
  type StoredResult,
  type WebhookAcquisition,
  type WebhookCheckout,
  type WebhookStore,
} from "../worker/firestore";
import type { PaidReportDependencies } from "../worker/paid-report";
import type { PurchaseStatusDependencies } from "../worker/purchase-status";
import type { ResultsDependencies } from "../worker/results";
import type { StripeCheckoutGateway, StripeWebhookGateway } from "../worker/stripe";
import type { WebhookDependencies } from "../worker/webhook";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";

const NOW = Date.parse("2026-07-18T00:00:00.000Z");
const ACCESS_TOKEN = "a".repeat(43);
const RESULT_ID = "11111111-1111-4111-8111-111111111111";
const WEBHOOK_SECRET = "whsec_test_only_not_a_real_secret";
const TOKEN_SECRET = "x".repeat(32);

const assets: Fetcher = { async fetch(): Promise<Response> { return new Response("SPA"); }, connect(): never { throw new Error("unused"); } };
function env(overrides: Omit<Partial<Env>, "ASSETS"> = {}): Env {
  return {
    ASSETS: assets,
    STRIPE_SALE_PRICE_MODE: "launch",
    STRIPE_SECRET_KEY: "sk_test_not-a-real-secret",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_LAUNCH_PRICE_ID: "price_launch_980",
    STRIPE_REGULAR_PRICE_ID: "price_regular_1980",
    PUBLIC_APP_URL: "https://diagnosis.example.test",
    FIREBASE_PROJECT_ID: "test-project",
    FIREBASE_CLIENT_EMAIL: "server@example.test",
    FIREBASE_PRIVATE_KEY: "not-a-real-private-key",
    REPORT_ACCESS_TOKEN_SECRET: TOKEN_SECRET,
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

const questions = flattenQuestionBank(questionBank);
const questionById = new Map(questions.map((question) => [question.id, question]));
const resolution: TypeResolution = { kind: "resolved", primary: "win", secondary: "connect", source: "base" };
const commonTypes: TypeId[] = ["win", "win", "win", "win", "win", "win", "win", "connect", "connect", "connect", "analyze", "axis"];
const numericValues: Record<string, number> = { DS1: 5, DS2: 1, DS3: 5, "DS-FIT": 5, "U-A1": 4, "U-A2": 4, "U-R1": 1, "U-O1": 4, "U-O2": 4, "U-R2": 1 };

function completedSession() {
  const route = buildDiagnosisRoute({ sessionId: "report-session", sessionSeed: "report-session-seed", resolution, confirmationNeeds: {}, transitionSequence: 1 });
  const answers: AnswerRecord[] = route.questionIds.map((questionId) => {
    const question = questionById.get(questionId);
    assert.ok(question, `missing ${questionId}`);
    if (question.block === "common-type") {
      const typeId = commonTypes[Number(question.id.slice(1)) - 1];
      const option = question.options.find((candidate) => candidate.typeId === typeId);
      assert.ok(option, `missing common option for ${questionId}`);
      return { questionId, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-18T00:00:00.000Z", durationMs: 5_000 };
    }
    if (question.format === "single-choice") return { questionId, questionVersion: question.version, optionId: question.options[0].id, answeredAt: "2026-07-18T00:00:00.000Z", durationMs: 5_000 };
    const numericValue = numericValues[questionId] ?? 3;
    return { questionId, questionVersion: question.version, optionId: String(numericValue), numericValue, answeredAt: "2026-07-18T00:00:00.000Z", durationMs: 5_000 };
  });
  return { ...newSession(), sessionId: "report-session", sessionSeed: "report-session-seed", route, answers, currentQuestionIds: [...route.questionIds] };
}

interface Stored {
  seed: ResultSeed;
  status: PurchaseStatus;
  expiresAt: number;
  checkoutState?: "creating" | "created" | "failed";
  checkoutSessionId?: string;
  expected?: ExpectedCheckout;
  fulfillmentEventId?: string;
  paidReport?: unknown;
  paidAt?: number;
  events: Set<string>;
}

class Store implements ResultStore, CheckoutStore, WebhookStore, PurchaseStatusStore, PaidReportStore {
  result: Stored | undefined;
  completeCalls = 0;
  failCalls = 0;
  constructor(private readonly now: () => number = () => NOW) {}
  async findOrCreate(seed: ResultSeed): Promise<StoredResult> {
    if (!this.result) this.result = { seed, status: "awaiting-payment", expiresAt: this.now() + 180 * 24 * 60 * 60 * 1000, events: new Set() };
    return { id: RESULT_ID, tokenUsable: this.result.status === "awaiting-payment" && this.result.expiresAt > this.now() };
  }
  async reserve(input: CheckoutInput, expected: ExpectedCheckout): Promise<CheckoutReservation> {
    if (!this.result || input.resultId !== RESULT_ID || input.accessToken !== ACCESS_TOKEN || this.result.status !== "awaiting-payment" || this.result.checkoutState === "creating" || this.result.checkoutSessionId) throw new CheckoutRejectedError();
    this.result.checkoutState = "creating";
    this.result.expected = expected;
    return { documentName: `projects/test-project/databases/(default)/documents/diagnosisResults/${RESULT_ID}` };
  }
  async saveCheckoutSession(_reservation: CheckoutReservation, sessionId: string): Promise<void> {
    assert.ok(this.result);
    this.result.checkoutState = "created";
    this.result.checkoutSessionId = sessionId;
  }
  async markCheckoutFailed(_reservation: CheckoutReservation): Promise<void> { if (this.result) this.result.checkoutState = "failed"; }
  async acquire(checkout: WebhookCheckout): Promise<WebhookAcquisition> {
    const result = this.result;
    if (!result || checkout.resultId !== RESULT_ID || result.events.has(checkout.eventId)) return { kind: "complete" };
    if (result.status === "generation-pending") return { kind: "busy" };
    if (result.status !== "awaiting-payment" || result.expiresAt <= this.now() || result.checkoutSessionId !== checkout.checkoutSessionId || !result.expected
      || checkout.priceIds.length !== 1 || checkout.priceIds[0] !== result.expected.priceId || checkout.amountTotal !== result.expected.amount || checkout.currency !== result.expected.currency || checkout.mode !== "payment" || checkout.paymentStatus !== "paid") throw new Error("invalid-webhook-checkout");
    result.status = "generation-pending";
    result.fulfillmentEventId = checkout.eventId;
    return { kind: "acquired", diagnosisSnapshot: result.seed.diagnosisSnapshot as unknown as DiagnosisSession };
  }
  async complete(checkout: WebhookCheckout, paidReport: unknown): Promise<void> {
    const result = this.result;
    if (!result || result.fulfillmentEventId !== checkout.eventId) throw new Error("fulfillment-lease-changed");
    this.completeCalls += 1;
    result.status = "paid";
    result.paidReport = paidReport;
    result.paidAt = this.now();
    result.expiresAt = this.now() + 180 * 24 * 60 * 60 * 1000;
    result.events.add(checkout.eventId);
  }
  async fail(checkout: WebhookCheckout): Promise<void> {
    const result = this.result;
    if (!result || result.fulfillmentEventId !== checkout.eventId) throw new Error("fulfillment-lease-changed");
    this.failCalls += 1;
    result.status = "generation-failed";
    result.paidAt = this.now();
    result.expiresAt = this.now() + 180 * 24 * 60 * 60 * 1000;
    result.events.add(checkout.eventId);
  }
  async findStatus(input: CheckoutInput): Promise<PurchaseStatus | undefined> {
    if (!this.result || input.resultId !== RESULT_ID || input.accessToken !== ACCESS_TOKEN) return undefined;
    return this.result.expiresAt > this.now() ? this.result.status : "expired";
  }
  async findPaidReport(hash: string): Promise<PaidReportRecord | undefined> {
    return this.result && hash === "h".repeat(64) ? { status: this.result.status, expiresAt: this.result.expiresAt, paidReport: this.result.paidReport } : undefined;
  }
}

class FailingCompleteStore extends Store {
  override async complete(_checkout: WebhookCheckout, _paidReport: unknown): Promise<void> { throw new Error("Firestore paid report write failed"); }
}

class CheckoutStripe implements StripeCheckoutGateway {
  async verifyActivePrice(_expected: ExpectedCheckout): Promise<void> {}
  async createCheckoutSession(_input: CheckoutInput, _expected: ExpectedCheckout): Promise<{ id: string; url: string }> { return { id: "cs_report_test", url: "https://checkout.stripe.com/c/pay/cs_report_test" }; }
}
class WebhookStripe implements StripeWebhookGateway {
  async lineItemPriceIds(_sessionId: string): Promise<string[]> { return ["price_launch_980"]; }
}

async function signature(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${Math.floor(NOW / 1000)}.${body}`;
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed)));
  return `t=${Math.floor(NOW / 1000)},v1=${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function dependencies(store: Store, reportNow: () => number = () => NOW) {
  const results: ResultsDependencies = { store, createAccessToken: () => ACCESS_TOKEN, accessTokenHash: async (token) => token === ACCESS_TOKEN ? "h".repeat(64) : "z".repeat(64) };
  const checkout: CheckoutDependencies = { store, stripe: new CheckoutStripe() };
  const webhook: WebhookDependencies = { store, stripe: new WebhookStripe(), now: () => NOW };
  const purchaseStatus: PurchaseStatusDependencies = { store };
  const paidReport: PaidReportDependencies = { store, accessTokenHash: async (token) => token === ACCESS_TOKEN ? "h".repeat(64) : "z".repeat(64), now: reportNow };
  return { results, checkout, webhook, purchaseStatus, paidReport };
}

const store = new Store();
const deps = dependencies(store);
const created = await handleRequest(new Request("https://worker.example.test/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: completedSession(), paidReport: "client-controlled" }) }), env(), { results: deps.results });
assert.equal(created.status, 201, "a completed diagnosis is persisted before purchase");
assert.deepEqual(await created.json(), { resultId: RESULT_ID, accessToken: ACCESS_TOKEN });
assert.equal(JSON.stringify(store.result?.seed.diagnosisSnapshot).includes("client-controlled"), false, "client-provided paid report text is never stored");
assert.equal((await handleRequest(new Request(`https://worker.example.test/api/paid-report/${ACCESS_TOKEN}`), env(), { paidReport: deps.paidReport })).status, 404, "unpaid results do not expose a report");

const checkout = await handleRequest(new Request("https://worker.example.test/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resultId: RESULT_ID, accessToken: ACCESS_TOKEN }) }), env(), { checkout: deps.checkout });
assert.equal(checkout.status, 200, "Checkout is created for the stored result");

const event = JSON.stringify({ id: "evt_paid_report", type: "checkout.session.completed", data: { object: { id: "cs_report_test", payment_status: "paid", mode: "payment", currency: "jpy", amount_total: 980, metadata: { resultId: RESULT_ID }, payment_intent: "pi_report_test" } } });
const webhookRequest = (): Promise<Request> => signature(event).then((header) => new Request("https://worker.example.test/api/webhook", { method: "POST", headers: { "Stripe-Signature": header }, body: event }));
const paid = await handleRequest(await webhookRequest(), env(), { webhook: deps.webhook });
assert.equal(paid.status, 200, "a signed payment completion creates the paid report");
assert.equal(store.result?.status, "paid", "generation-pending advances to paid only after report persistence");
assert.equal(store.completeCalls, 1, "the report is persisted exactly once");
assert.ok(store.result?.paidReport && typeof store.result.paidReport === "object", "the server-generated report is saved");
assert.equal(store.result?.expiresAt, NOW + 180 * 24 * 60 * 60 * 1000, "report access expires 180 days after payment completion");

const status = await handleRequest(new Request("https://worker.example.test/api/purchase-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resultId: RESULT_ID, accessToken: ACCESS_TOKEN }) }), env(), { purchaseStatus: deps.purchaseStatus });
assert.deepEqual(await status.json(), { status: "paid" }, "the unchanged purchase-completion UI contract observes paid status");
const report = await handleRequest(new Request(`https://worker.example.test/api/paid-report/${ACCESS_TOKEN}`), env(), { paidReport: deps.paidReport });
assert.equal(report.status, 200, "a valid access token can view the persisted report");
assert.equal(report.headers.get("Cache-Control"), "no-store");
assert.equal(report.headers.get("X-Robots-Tag"), "noindex, nofollow");
const visible = await report.json() as { label: string; subtitle: string; sections: unknown[] };
assert.ok(visible.label && visible.subtitle && visible.sections.length > 0, "the existing paid-report view shape is preserved");
assert.equal(JSON.stringify(visible).includes("accessTokenHash"), false, "report responses do not expose Firestore ownership data");

const replay = await handleRequest(await webhookRequest(), env(), { webhook: deps.webhook });
assert.equal(replay.status, 200, "replayed events are acknowledged");
assert.equal(store.completeCalls, 1, "replayed events do not generate a second report");
const expiredDeps = dependencies(store, () => NOW + 180 * 24 * 60 * 60 * 1000 + 1);
assert.equal((await handleRequest(new Request(`https://worker.example.test/api/paid-report/${ACCESS_TOKEN}`), env(), { paidReport: expiredDeps.paidReport })).status, 404, "expired reports are not returned");
assert.equal((await handleRequest(new Request("https://worker.example.test/api/paid-report/not-a-token"), env(), { paidReport: deps.paidReport })).status, 404, "invalid tokens do not disclose report state");
assert.equal((await handleRequest(new Request(`https://worker.example.test/api/paid-report/${"b".repeat(43)}`), env(), { paidReport: deps.paidReport })).status, 404, "a well-formed but mismatched token does not disclose a report");
assert.equal((await handleRequest(new Request(`https://worker.example.test/api/paid-report/${ACCESS_TOKEN}`, { method: "POST" }), env(), { paidReport: deps.paidReport })).status, 405, "report API rejects non-GET methods");
assert.equal((await handleRequest(new Request("https://worker.example.test/api/purchase-status", { method: "GET" }), env(), { purchaseStatus: deps.purchaseStatus })).status, 405, "purchase status rejects non-POST methods");
assert.equal((await handleRequest(new Request("https://worker.example.test/api/purchase-status", { method: "POST", body: "{" }), env(), { purchaseStatus: deps.purchaseStatus })).status, 500, "malformed purchase-status requests preserve the existing generic failure response");

const brokenStore = new Store();
const broken = dependencies(brokenStore);
await brokenStore.findOrCreate({ sessionId: "broken", diagnosisSnapshot: {}, accessTokenHash: "h".repeat(64), reportTemplateVersion: "report-v1" });
await brokenStore.reserve({ resultId: RESULT_ID, accessToken: ACCESS_TOKEN }, { priceId: "price_launch_980", amount: 980, currency: "jpy" });
await brokenStore.saveCheckoutSession({ documentName: `projects/test-project/databases/(default)/documents/diagnosisResults/${RESULT_ID}` }, "cs_report_test");
assert.equal((await handleRequest(await webhookRequest(), env(), { webhook: broken.webhook })).status, 200, "permanent report-generation failure is acknowledged after state persistence");
assert.equal(brokenStore.result?.status, "generation-failed", "invalid stored snapshots never become paid");
assert.equal(brokenStore.failCalls, 1, "generation failure is recorded once without a stack trace");
assert.equal((await handleRequest(new Request(`https://worker.example.test/api/paid-report/${ACCESS_TOKEN}`), env(), { paidReport: broken.paidReport })).status, 404, "failed generation remains indistinguishable from other unavailable reports");
assert.equal((await handleRequest(await webhookRequest(), env(), { webhook: broken.webhook })).status, 200, "a generation-failed event replay is acknowledged");
assert.equal(brokenStore.failCalls, 1, "a generation-failed replay does not retry report generation");

const busyStore = new Store();
await busyStore.findOrCreate({ sessionId: "busy", diagnosisSnapshot: completedSession(), accessTokenHash: "h".repeat(64), reportTemplateVersion: "report-v1" });
await busyStore.reserve({ resultId: RESULT_ID, accessToken: ACCESS_TOKEN }, { priceId: "price_launch_980", amount: 980, currency: "jpy" });
await busyStore.saveCheckoutSession({ documentName: `projects/test-project/databases/(default)/documents/diagnosisResults/${RESULT_ID}` }, "cs_report_test");
assert.ok(busyStore.result);
busyStore.result.status = "generation-pending";
const busy = dependencies(busyStore);
assert.equal((await handleRequest(await webhookRequest(), env(), { webhook: busy.webhook })).status, 200, "an active generation lease is acknowledged without duplicate generation");
assert.equal(busyStore.completeCalls, 0, "an active generation lease does not persist a duplicate report");

const saveFailureStore = new FailingCompleteStore();
await saveFailureStore.findOrCreate({ sessionId: "save-failure", diagnosisSnapshot: completedSession(), accessTokenHash: "h".repeat(64), reportTemplateVersion: "report-v1" });
await saveFailureStore.reserve({ resultId: RESULT_ID, accessToken: ACCESS_TOKEN }, { priceId: "price_launch_980", amount: 980, currency: "jpy" });
await saveFailureStore.saveCheckoutSession({ documentName: `projects/test-project/databases/(default)/documents/diagnosisResults/${RESULT_ID}` }, "cs_report_test");
const saveFailure = dependencies(saveFailureStore);
assert.equal((await handleRequest(await webhookRequest(), env(), { webhook: saveFailure.webhook })).status, 500, "Firestore report-save failures remain retryable");
assert.equal(saveFailureStore.result?.status, "generation-pending", "a failed report save never creates a partial paid state");

console.log("Cloudflare paid report generation, purchase status, access control, expiry, and idempotency tests passed");
