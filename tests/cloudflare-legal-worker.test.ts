import { strict as assert } from "node:assert";
import { handleRequest } from "../worker";
import type { Env } from "../worker/env";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";

const assets: Fetcher = {
  async fetch(): Promise<Response> { return new Response("<html>SPA</html>"); },
  connect(): never { throw new Error("ASSETS.connect must not be called"); },
};

function onRequestEnv(overrides: Omit<Partial<Env>, "ASSETS"> = {}): Env {
  return {
    ASSETS: assets,
    LEGAL_DISCLOSURE_MODE: "on-request",
    LEGAL_CONTACT_EMAIL: PUBLIC_SALES_CONFIG.contactEmail,
    STRIPE_SECRET_KEY: "sk_test_not-a-real-secret",
    FIREBASE_PRIVATE_KEY: "not-a-real-private-key",
    ...overrides,
  };
}

const response = await handleRequest(new Request("https://worker.example.test/api/legal"), onRequestEnv());
assert.equal(response.status, 200, "GET /api/legal succeeds");
assert.equal(response.headers.get("Cache-Control"), "no-store", "legal configuration responses are not cacheable");
assert.match(response.headers.get("Content-Type") ?? "", /^application\/json/, "legal configuration responses are JSON");
assert.deepEqual(await response.json(), { configured: true }, "on-request disclosure with the approved contact address is configured");

const mismatchedContact = await handleRequest(
  new Request("https://worker.example.test/api/legal"),
  onRequestEnv({ LEGAL_CONTACT_EMAIL: "other@example.test" }),
);
assert.deepEqual(await mismatchedContact.json(), { configured: false }, "a non-public contact address fails closed without disclosure details");

const missingConfiguration = await handleRequest(
  new Request("https://worker.example.test/api/legal"),
  onRequestEnv({ LEGAL_DISCLOSURE_MODE: undefined }),
);
const missingBody = await missingConfiguration.text();
assert.deepEqual(JSON.parse(missingBody), { configured: false }, "missing legal configuration has a stable safe response");
for (const value of ["sk_test_not-a-real-secret", "not-a-real-private-key", "other@example.test", "LEGAL_CONTACT_EMAIL"]) {
  assert.equal(missingBody.includes(value), false, "legal responses never disclose secrets, values, or missing setting names");
}

const methodResponse = await handleRequest(new Request("https://worker.example.test/api/legal", { method: "POST" }), onRequestEnv());
assert.equal(methodResponse.status, 405, "only GET is allowed for /api/legal");
assert.equal(methodResponse.headers.get("Allow"), "GET", "legal 405 responses declare GET");

const unknownApi = await handleRequest(new Request("https://worker.example.test/api/not-migrated"), onRequestEnv());
assert.equal(unknownApi.status, 404, "unknown API routes remain JSON 404 responses");

console.log("Cloudflare legal Worker public contract and fail-closed tests passed");
