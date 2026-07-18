import { strict as assert } from "node:assert";
import { handleRequest } from "../worker";
import type { Env } from "../worker/env";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";

const assetRequests: string[] = [];
const assets: Fetcher = {
  async fetch(input): Promise<Response> {
    assetRequests.push(input instanceof Request ? input.url : input.toString());
    return new Response("<!doctype html><title>SPA</title>", { headers: { "Content-Type": "text/html" } });
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

const launchResponse = await handleRequest(new Request("https://worker.example.test/api/offer"), completeEnv());
assert.equal(launchResponse.status, 200, "GET /api/offer succeeds");
assert.equal(launchResponse.headers.get("Cache-Control"), "no-store", "offer responses are never cached");
assert.match(launchResponse.headers.get("Content-Type") ?? "", /^application\/json/, "offer responses are JSON");
assert.deepEqual(await launchResponse.json(), {
  regularPriceYen: 1980,
  activePriceYen: 980,
  activeLabel: "サービス開始記念価格",
  purchaseAvailable: true,
  purchaseStatus: "available",
  purchaseMessage: "有料レポートの購入手続きを開始できます。",
}, "launch mode returns the public offer contract");

const regularOffer = await handleRequest(new Request("https://worker.example.test/api/offer"), completeEnv({ STRIPE_SALE_PRICE_MODE: "regular" }));
assert.equal(regularOffer.status, 200, "regular mode offer requests succeed");
assert.deepEqual(await regularOffer.json(), {
  regularPriceYen: 1980,
  activePriceYen: 1980,
  activeLabel: "通常価格",
  purchaseAvailable: true,
  purchaseStatus: "available",
  purchaseMessage: "有料レポートの購入手続きを開始できます。",
}, "regular mode returns the regular public offer");

const preparingResponse = await handleRequest(new Request("https://worker.example.test/api/offer"), completeEnv({ STRIPE_SECRET_KEY: "" }));
assert.deepEqual(await preparingResponse.json(), {
  regularPriceYen: 1980,
  activePriceYen: 980,
  activeLabel: "サービス開始記念価格",
  purchaseAvailable: false,
  purchaseStatus: "preparing",
  purchaseMessage: "有料レポートは現在準備中です。販売開始までお待ちください。",
}, "missing required configuration keeps the offer endpoint available but fail-closed");

const methodResponse = await handleRequest(new Request("https://worker.example.test/api/offer", { method: "POST" }), completeEnv());
assert.equal(methodResponse.status, 405, "non-GET /api/offer requests are rejected");
assert.equal(methodResponse.headers.get("Allow"), "GET", "405 responses declare the permitted method");

const unknownApiResponse = await handleRequest(new Request("https://worker.example.test/api/not-migrated"), completeEnv());
assert.equal(unknownApiResponse.status, 404, "unknown API routes do not fall back to the SPA shell");
assert.match(unknownApiResponse.headers.get("Content-Type") ?? "", /^application\/json/, "unknown API routes return a JSON 404");

assetRequests.length = 0;
const screenResponse = await handleRequest(new Request("https://worker.example.test/terms"), completeEnv());
assert.equal(screenResponse.status, 200, "screen routes are delegated to static assets");
assert.equal(await screenResponse.text(), "<!doctype html><title>SPA</title>");
assert.deepEqual(assetRequests, ["https://worker.example.test/terms"], "the Worker delegates ordinary routes to ASSETS.fetch");

console.log("Cloudflare offer Worker routing and fail-closed tests passed");
