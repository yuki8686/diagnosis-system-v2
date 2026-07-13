import { strict as assert } from "node:assert";
import { readJson, type ApiRequest } from "../api/_lib/http";

const parsedByVercel = { body: { resultId: "example" } } as ApiRequest;
assert.deepEqual(await readJson(parsedByVercel, 1_024), { resultId: "example" }, "JSON APIs accept Vercel's parsed request.body helper");
await assert.rejects(() => readJson({ body: { value: "x".repeat(100) } } as ApiRequest, 32), /too large/i, "parsed API payloads retain an application size limit");
const streamed = {
  body: undefined,
  async *[Symbol.asyncIterator]() { yield Buffer.from('{"value":1}', "utf8"); },
} as unknown as ApiRequest;
assert.deepEqual(await readJson(streamed, 1_024), { value: 1 }, "JSON APIs retain a stream fallback outside Vercel");
console.log("API body parsing and size-limit tests passed");
