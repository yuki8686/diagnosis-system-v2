import type { Env } from "./env";
import { createFirestorePurchaseStatusStore, type CheckoutInput, type PurchaseStatusStore } from "./firestore";

const MAX_REQUEST_BYTES = 4_096;
const PURCHASE_STATUS_ERROR = "購入状況を確認できませんでした。";

export interface PurchaseStatusDependencies {
  store: PurchaseStatusStore;
}

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function checkoutInput(value: unknown): CheckoutInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { resultId?: unknown; accessToken?: unknown };
  if (typeof candidate.resultId !== "string" || !/^[0-9a-f-]{36}$/iu.test(candidate.resultId)) return undefined;
  if (typeof candidate.accessToken !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(candidate.accessToken)) return undefined;
  return { resultId: candidate.resultId, accessToken: candidate.accessToken };
}

async function requestJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) throw new Error("body-too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body-missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error("body-too-large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new Error("invalid-json"); }
}

export async function purchaseStatusResponse(request: Request, env: Env, dependencies?: PurchaseStatusDependencies): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  try {
    const input = checkoutInput(await requestJson(request));
    if (!input) return jsonResponse(400, { error: PURCHASE_STATUS_ERROR });
    const store = dependencies?.store ?? createFirestorePurchaseStatusStore(env);
    const status = await store.findStatus(input);
    if (!status) return jsonResponse(404, { error: PURCHASE_STATUS_ERROR });
    return jsonResponse(200, { status });
  } catch {
    return jsonResponse(500, { error: PURCHASE_STATUS_ERROR });
  }
}
