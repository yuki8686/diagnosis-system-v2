import { strict as assert } from "node:assert";
import { handleRequest } from "../worker";
import type { Env } from "../worker/env";
import { createFeedbackDocumentFields, type FeedbackInput, type FeedbackSaveResult, type FeedbackStore } from "../worker/firestore";

const resultId = "11111111-1111-4111-8111-111111111111";
const accessToken = "a".repeat(43);
const TEST_NOW = Date.parse("2026-07-20T00:00:00.000Z");

const assets: Fetcher = {
  async fetch(): Promise<Response> { return new Response("<html>SPA</html>"); },
  connect(): never { throw new Error("ASSETS.connect must not be called"); },
};

const env: Env = { ASSETS: assets };

class FakeFeedbackStore implements FeedbackStore {
  input: FeedbackInput | undefined;
  constructor(private readonly result: FeedbackSaveResult = "saved", private readonly failure?: Error) {}
  async save(input: FeedbackInput): Promise<FeedbackSaveResult> {
    this.input = input;
    if (this.failure) throw this.failure;
    return this.result;
  }
}

function request(body: BodyInit = JSON.stringify({ resultId, accessToken, rating: 5, comment: "  役に立ちました  " })): Request {
  return new Request("https://worker.example.test/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const savedStore = new FakeFeedbackStore();
const saved = await handleRequest(request(), env, { feedback: { store: savedStore } });
assert.equal(saved.status, 201, "valid feedback is saved");
assert.equal(saved.headers.get("Cache-Control"), "no-store", "feedback responses are not cacheable");
assert.deepEqual(await saved.json(), { saved: true });
assert.deepEqual(savedStore.input, { resultId, accessToken, rating: 5, comment: "役に立ちました" }, "the Worker reuses the existing validation and only passes a trimmed comment");

const schema = createFeedbackDocumentFields({ resultId, accessToken, rating: 3, comment: "コメント" }, TEST_NOW, TEST_NOW + 1_000);
assert.equal(schema.version?.integerValue, "1", "feedback schema retains its version");
assert.equal(schema.resultId?.stringValue, resultId, "feedback is tied to its result ID");
assert.equal(schema.rating?.integerValue, "3", "feedback stores the rating as an integer");
assert.equal(schema.comment?.stringValue, "コメント", "feedback stores the sanitized optional comment");
assert.equal(JSON.stringify(schema).includes(accessToken), false, "feedback documents never store the ownership access token");

for (const [result, status] of [["missing", 404], ["invalid-token", 404], ["expired", 410], ["already-exists", 409]] as const) {
  const response = await handleRequest(request(), env, { feedback: { store: new FakeFeedbackStore(result) } });
  assert.equal(response.status, status, `${result} feedback is handled without exposing Firestore state`);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
}

const malformed = await handleRequest(request("{"), env, { feedback: { store: new FakeFeedbackStore() } });
assert.equal(malformed.status, 400, "malformed JSON is rejected");
const tooLarge = await handleRequest(request("x".repeat(8_193)), env, { feedback: { store: new FakeFeedbackStore() } });
assert.equal(tooLarge.status, 400, "oversized bodies are rejected");
const invalidId = await handleRequest(request(JSON.stringify({ resultId: "not-a-result", accessToken, rating: 5 })), env, { feedback: { store: new FakeFeedbackStore() } });
assert.equal(invalidId.status, 400, "invalid result IDs are rejected");
const missingRating = await handleRequest(request(JSON.stringify({ resultId, accessToken })), env, { feedback: { store: new FakeFeedbackStore() } });
assert.equal(missingRating.status, 400, "missing ratings are rejected");
const oversizedComment = await handleRequest(request(JSON.stringify({ resultId, accessToken, rating: 5, comment: "x".repeat(501) })), env, { feedback: { store: new FakeFeedbackStore() } });
assert.equal(oversizedComment.status, 400, "oversized comments are rejected");
const method = await handleRequest(new Request("https://worker.example.test/api/feedback"), env);
assert.equal(method.status, 405, "feedback only accepts POST");
assert.equal(method.headers.get("Allow"), "POST");

const failed = await handleRequest(request(), env, { feedback: { store: new FakeFeedbackStore("saved", new Error("FIREBASE_PRIVATE_KEY secret")) } });
assert.equal(failed.status, 500, "Firestore failures return a generic error");
assert.equal((await failed.text()).includes("FIREBASE_PRIVATE_KEY"), false, "internal errors do not expose secrets");

console.log("Cloudflare feedback Worker validation, ownership-safe persistence, and failure tests passed");
