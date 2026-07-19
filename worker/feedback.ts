import { feedbackPayload } from "../api/_lib/feedback";
import type { Env } from "./env";
import { createFirestoreFeedbackStore, type FeedbackStore } from "./firestore";

const MAX_REQUEST_BYTES = 8_192;
const RESULT_NOT_FOUND_ERROR = "診断結果を確認できませんでした。";
const SAVE_FAILED_ERROR = "フィードバックを保存できませんでした。時間をおいてもう一度お試しください。";

export interface FeedbackDependencies {
  store: FeedbackStore;
}

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readRequestJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) throw new Error("request-too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("request-body-missing");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("request-too-large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("invalid-json");
  }
}

function runtimeDependencies(env: Env): FeedbackDependencies {
  return { store: createFirestoreFeedbackStore(env) };
}

export async function feedbackResponse(request: Request, env: Env, dependencies?: FeedbackDependencies): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  let payload: ReturnType<typeof feedbackPayload>;
  try {
    payload = feedbackPayload(await readRequestJson(request));
  } catch {
    return jsonResponse(400, { error: "入力内容を確認してください。" });
  }
  if (!payload) return jsonResponse(400, { error: "入力内容を確認してください。" });
  try {
    const result = await (dependencies ?? runtimeDependencies(env)).store.save(payload);
    if (result === "saved") return jsonResponse(201, { saved: true });
    if (result === "missing" || result === "invalid-token") return jsonResponse(404, { error: RESULT_NOT_FOUND_ERROR });
    if (result === "expired") return jsonResponse(410, { error: "この結果へのフィードバック受付期間は終了しました。" });
    return jsonResponse(409, { error: "この結果のフィードバックはすでに保存されています。" });
  } catch {
    return jsonResponse(500, { error: SAVE_FAILED_ERROR });
  }
}
