import { strict as assert } from "node:assert";
import { flattenQuestionBank } from "../src/data/question-bank-contract";
import { questionBank } from "../src/data/question-bank";
import { buildDiagnosisRoute } from "../src/routing";
import { newSession } from "../src/ui/session";
import { finishDiagnosis } from "../src/ui/engine";
import type { AnswerRecord, DiagnosisRoute, TypeId, TypeResolution } from "../src/types";
import { handleRequest } from "../worker";
import type { CheckoutDependencies } from "../worker/checkout";
import type { Env } from "../worker/env";
import {
  CheckoutRejectedError,
  createResultDocumentFields,
  matchesAccessTokenHash,
  type CheckoutInput,
  type CheckoutReservation,
  type CheckoutStore,
  type ExpectedCheckout,
  type ResultSeed,
  type ResultStore,
  type StoredResult,
} from "../worker/firestore";
import type { ResultsDependencies } from "../worker/results";
import type { StripeCheckoutGateway } from "../worker/stripe";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";

const TEST_NOW = Date.parse("2026-07-18T00:00:00.000Z");
const TEST_SECRET = "x".repeat(32);
const firstResultId = "11111111-1111-4111-8111-111111111111";
const secondResultId = "22222222-2222-4222-8222-222222222222";

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
    REPORT_ACCESS_TOKEN_SECRET: TEST_SECRET,
    LEGAL_DISCLOSURE_MODE: "on-request",
    LEGAL_CONTACT_EMAIL: PUBLIC_SALES_CONFIG.contactEmail,
    ...overrides,
  };
}

const allQuestions = flattenQuestionBank(questionBank);
const questionById = new Map(allQuestions.map((question) => [question.id, question]));
const resolved: TypeResolution = { kind: "resolved", primary: "win", secondary: "connect", source: "base" };
const commonTypes: TypeId[] = ["win", "win", "win", "win", "win", "win", "win", "connect", "connect", "connect", "analyze", "axis"];
const numericDefaults: Record<string, number> = { DS1: 5, DS2: 1, DS3: 5, "DS-FIT": 5, "U-A1": 4, "U-A2": 4, "U-R1": 1, "U-O1": 4, "U-O2": 4, "U-R2": 1 };

function answersFor(route: DiagnosisRoute): AnswerRecord[] {
  return route.questionIds.map((questionId) => {
    const question = questionById.get(questionId);
    assert.ok(question, `missing ${questionId}`);
    if (question.block === "common-type") {
      const typeId = commonTypes[Number(question.id.slice(1)) - 1];
      const option = question.options.find((candidate) => candidate.typeId === typeId);
      assert.ok(option, `missing common option for ${questionId}`);
      return { questionId, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-18T00:00:00.000Z", durationMs: 5000 };
    }
    if (question.format === "single-choice") return { questionId, questionVersion: question.version, optionId: question.options[0].id, answeredAt: "2026-07-18T00:00:00.000Z", durationMs: 5000 };
    const numericValue = numericDefaults[questionId] ?? 3;
    return { questionId, questionVersion: question.version, optionId: String(numericValue), numericValue, answeredAt: "2026-07-18T00:00:00.000Z", durationMs: 5000 };
  });
}

function completedSession() {
  const route = buildDiagnosisRoute({
    sessionId: "result-session",
    sessionSeed: "result-session-seed",
    resolution: resolved,
    confirmationNeeds: {},
    transitionSequence: 1,
  });
  return {
    ...newSession(),
    sessionId: "result-session",
    sessionSeed: "result-session-seed",
    route,
    answers: answersFor(route),
    currentQuestionIds: [...route.questionIds],
  };
}

interface InMemoryResult {
  seed: ResultSeed;
  status: "awaiting-payment" | "paid";
  expiresAt: number;
  checkoutCreationState?: "creating" | "created" | "failed";
  stripeCheckoutSessionId?: string;
}

class InMemoryFirestore implements ResultStore, CheckoutStore {
  readonly results = new Map<string, InMemoryResult>();
  readonly sessionIndex = new Map<string, string>();
  readonly calls: string[] = [];
  expectedCheckout: ExpectedCheckout | undefined;
  private nextId = firstResultId;

  constructor(private readonly secret: string, private readonly collision = false) {
    if (collision) this.results.set(firstResultId, { seed: { sessionId: "other", diagnosisSnapshot: {}, accessTokenHash: "other", reportTemplateVersion: "other" }, status: "awaiting-payment", expiresAt: TEST_NOW + 180 * 24 * 60 * 60 * 1000 });
  }

  async findOrCreate(seed: ResultSeed): Promise<StoredResult> {
    this.calls.push("create-result");
    const indexed = this.sessionIndex.get(seed.sessionId);
    if (indexed) {
      const existing = this.results.get(indexed);
      if (!existing) throw new Error("missing-indexed-result");
      const tokenUsable = existing.status === "awaiting-payment" && existing.expiresAt > TEST_NOW;
      if (tokenUsable) existing.seed = { ...existing.seed, accessTokenHash: seed.accessTokenHash };
      return { id: indexed, tokenUsable };
    }
    let id = this.nextId;
    if (this.results.has(id)) id = secondResultId;
    this.nextId = secondResultId;
    this.results.set(id, { seed, status: "awaiting-payment", expiresAt: TEST_NOW + 180 * 24 * 60 * 60 * 1000 });
    this.sessionIndex.set(seed.sessionId, id);
    return { id, tokenUsable: true };
  }

  async reserve(input: CheckoutInput, expected: ExpectedCheckout): Promise<CheckoutReservation> {
    this.calls.push("reserve-checkout");
    this.expectedCheckout = expected;
    const result = this.results.get(input.resultId);
    if (!result
      || result.status !== "awaiting-payment"
      || result.expiresAt <= TEST_NOW
      || result.checkoutCreationState === "creating"
      || result.stripeCheckoutSessionId
      || !await matchesAccessTokenHash(input.accessToken, result.seed.accessTokenHash, this.secret)) throw new CheckoutRejectedError();
    result.checkoutCreationState = "creating";
    return { documentName: `projects/test-project/databases/(default)/documents/diagnosisResults/${input.resultId}` };
  }

  async saveCheckoutSession(reservation: CheckoutReservation, sessionId: string): Promise<void> {
    this.calls.push("save-checkout");
    const resultId = reservation.documentName.split("/").at(-1);
    const result = resultId ? this.results.get(resultId) : undefined;
    if (!result) throw new Error("missing-result");
    result.stripeCheckoutSessionId = sessionId;
    result.checkoutCreationState = "created";
  }

  async markCheckoutFailed(reservation: CheckoutReservation): Promise<void> {
    this.calls.push("fail-checkout");
    const resultId = reservation.documentName.split("/").at(-1);
    const result = resultId ? this.results.get(resultId) : undefined;
    if (result) result.checkoutCreationState = "failed";
  }
}

class FakeStripe implements StripeCheckoutGateway {
  calls: string[] = [];
  async verifyActivePrice(_expected: ExpectedCheckout): Promise<void> { this.calls.push("verify"); }
  async createCheckoutSession(_input: CheckoutInput, _expected: ExpectedCheckout): Promise<{ id: string; url: string }> {
    this.calls.push("create");
    return { id: "cs_test_results", url: "https://checkout.stripe.com/c/pay/cs_test_results" };
  }
}

function resultsDependencies(store: ResultStore): ResultsDependencies {
  let tokenCounter = 0;
  return {
    store,
    createAccessToken: () => `${String.fromCharCode(65 + tokenCounter++)}`.repeat(43),
    accessTokenHash: async (accessToken) => {
      const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(TEST_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(accessToken)));
      return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
  };
}

function resultsRequest(session: unknown): Request {
  return new Request("https://worker.example.test/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session }) });
}

const schemaSeed: ResultSeed = { sessionId: "session", diagnosisSnapshot: { answers: [{ questionId: "Q1", numericValue: 3 }] }, accessTokenHash: "a".repeat(64), reportTemplateVersion: "report-v1" };
const schema = createResultDocumentFields(schemaSeed, TEST_NOW);
assert.equal(schema.status?.stringValue, "awaiting-payment", "new result documents begin awaiting payment");
assert.equal(schema.expiresAt?.timestampValue, "2027-01-14T00:00:00.000Z", "payment-waiting expiry uses the existing 180-day calculation");
assert.equal(schema.answerDataExpiresAt?.timestampValue, "2026-08-17T00:00:00.000Z", "answer data expiry remains 30 days");
assert.equal(schema.feedbackExpiresAt?.timestampValue, "2028-07-17T00:00:00.000Z", "feedback expiry remains 730 days");
assert.equal(schema.accessTokenHash?.stringValue, schemaSeed.accessTokenHash, "Firestore stores only the HMAC hash");
assert.equal(JSON.stringify(schema).includes("accessToken"), true, "schema exposes the field name only, not a plaintext access token");

const persistence = new InMemoryFirestore(TEST_SECRET);
const completed = completedSession();
const session = { ...completed, freeReport: { attacker: "do-not-store" }, paidReport: "do-not-store" };
assert.doesNotThrow(() => finishDiagnosis(completed), "the fixture is complete before crossing the JSON boundary");
const createResponse = await handleRequest(resultsRequest(session), completeEnv(), { results: resultsDependencies(persistence) });
assert.equal(createResponse.status, 201, `a completed diagnosis creates a server result: ${await createResponse.clone().text()}`);
const created = await createResponse.json() as { resultId: string; accessToken: string };
assert.deepEqual(Object.keys(created).sort(), ["accessToken", "resultId"], "the existing client response contract is preserved");
assert.equal(created.resultId, firstResultId);
assert.match(created.accessToken, /^[A-Za-z0-9_-]{43}$/u, "result access tokens use the existing 32-byte base64url shape");
const stored = persistence.results.get(created.resultId);
assert.ok(stored, "the result is stored for Checkout");
assert.equal(stored.status, "awaiting-payment", "Checkout sees the expected initial status");
assert.equal(stored.expiresAt, TEST_NOW + 180 * 24 * 60 * 60 * 1000, "the payment-waiting expiry is set at creation");
assert.equal(JSON.stringify(stored.seed.diagnosisSnapshot).includes("do-not-store"), false, "client-provided free or paid report text is never persisted");
assert.equal(await matchesAccessTokenHash(created.accessToken, stored.seed.accessTokenHash, TEST_SECRET), true, "stored HMAC ownership proof matches the returned token");

const stripe = new FakeStripe();
const checkoutDependencies: CheckoutDependencies = { store: persistence, stripe };
const checkoutResponse = await handleRequest(new Request("https://worker.example.test/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(created) }), completeEnv(), { checkout: checkoutDependencies });
assert.equal(checkoutResponse.status, 200, "a Worker-created result is accepted by the Worker Checkout handler");
assert.deepEqual(await checkoutResponse.json(), { checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_results" });
assert.deepEqual(stripe.calls, ["verify", "create"], "the integration path creates exactly one Stripe Session");
assert.equal(stored.stripeCheckoutSessionId, "cs_test_results", "Checkout saves its Session ID on the result created by /api/results");

const invalidVersion = await handleRequest(resultsRequest({ ...completedSession(), versions: { questionBankVersion: "old", scoringVersion: "old", engineVersion: "old", reportTemplateVersion: "old" } }), completeEnv(), { results: resultsDependencies(new InMemoryFirestore(TEST_SECRET)) });
assert.equal(invalidVersion.status, 400, "version-mismatched sessions are rejected");
const invalidJson = await handleRequest(new Request("https://worker.example.test/api/results", { method: "POST", body: "{" }), completeEnv(), { results: resultsDependencies(new InMemoryFirestore(TEST_SECRET)) });
assert.equal(invalidJson.status, 400, "invalid JSON returns 400");
const tooLarge = await handleRequest(new Request("https://worker.example.test/api/results", { method: "POST", body: "x".repeat(256_001) }), completeEnv(), { results: resultsDependencies(new InMemoryFirestore(TEST_SECRET)) });
assert.equal(tooLarge.status, 400, "oversized result requests return 400");
const method = await handleRequest(new Request("https://worker.example.test/api/results"), completeEnv());
assert.equal(method.status, 405, "non-POST results methods are rejected");
assert.equal(method.headers.get("Allow"), "POST");

const unavailable = new InMemoryFirestore(TEST_SECRET);
const unavailableResponse = await handleRequest(resultsRequest(completedSession()), completeEnv({ STRIPE_SECRET_KEY: "" }), { results: resultsDependencies(unavailable) });
assert.equal(unavailableResponse.status, 503, "missing purchase configuration fails closed before Firestore");
assert.deepEqual(unavailable.calls, [], "unavailable result creation never writes Firestore");

const collisionStore = new InMemoryFirestore(TEST_SECRET, true);
const collisionResponse = await handleRequest(resultsRequest(completedSession()), completeEnv(), { results: resultsDependencies(collisionStore) });
assert.equal(collisionResponse.status, 201, "a generated ID collision is handled without overwriting the existing result");
assert.equal((await collisionResponse.json() as { resultId: string }).resultId, secondResultId, "the collision path uses a fresh result ID");

const failingStore: ResultStore = { async findOrCreate(): Promise<StoredResult> { throw new Error("FIREBASE_PRIVATE_KEY must not be exposed"); } };
const failedResponse = await handleRequest(resultsRequest(completedSession()), completeEnv(), { results: resultsDependencies(failingStore) });
assert.equal(failedResponse.status, 500, "Firestore failures return a generic error");
assert.equal(JSON.stringify(await failedResponse.json()).includes("FIREBASE_PRIVATE_KEY"), false, "Firestore implementation details are not exposed");

console.log("Cloudflare results Worker creation, schema, ownership, and checkout integration tests passed");
