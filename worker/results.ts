import { finishDiagnosis } from "../src/ui/engine";
import { versionsMatch, type DiagnosisSession } from "../src/ui/session";
import type { Env } from "./env";
import {
  accessTokenHashHex,
  createFirestoreResultStore,
  createReportAccessToken,
  type ResultSeed,
  type ResultStore,
} from "./firestore";
import { purchaseConfigurationIsComplete } from "./offer";

const MAX_REQUEST_BYTES = 256_000;
const INVALID_RESULT_REQUEST = "診断結果を準備できませんでした。診断結果画面を開き直してください。";
const INCOMPLETE_DIAGNOSIS = "診断が完了していません。";
const RESULTS_UNAVAILABLE = "診断結果を準備できませんでした。時間をおいてもう一度お試しください。";

export interface ResultsDependencies {
  store: ResultStore;
  createAccessToken: () => string;
  accessTokenHash: (accessToken: string) => Promise<string>;
}

function jsonResponse(status: number, value: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function purchaseUnavailableResponse(): Response {
  return jsonResponse(503, {
    code: "purchase_unavailable",
    error: "有料レポートは現在準備中です。販売開始までお待ちください。",
    purchaseAvailable: false,
    purchaseStatus: "preparing",
  }, { "Cache-Control": "no-store" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sessionFrom(value: unknown): DiagnosisSession | undefined {
  if (!isRecord(value) || !isRecord(value.session)) return undefined;
  const candidate = value.session;
  if (typeof candidate.sessionId !== "string"
    || typeof candidate.sessionSeed !== "string"
    || !Array.isArray(candidate.answers)
    || !Array.isArray(candidate.currentQuestionIds)
    || !candidate.currentQuestionIds.every((id) => typeof id === "string")
    || typeof candidate.currentPageIndex !== "number"
    || !Number.isInteger(candidate.currentPageIndex)
    || candidate.currentPageIndex < 0
    || typeof candidate.savedAt !== "string"
    || !versionsMatch(candidate)) return undefined;
  return {
    sessionId: candidate.sessionId,
    sessionSeed: candidate.sessionSeed,
    answers: candidate.answers as DiagnosisSession["answers"],
    currentQuestionIds: candidate.currentQuestionIds,
    currentPageIndex: candidate.currentPageIndex,
    savedAt: candidate.savedAt,
    versions: candidate.versions,
    ...(isRecord(candidate.route) ? { route: candidate.route as DiagnosisSession["route"] } : {}),
    ...(isRecord(candidate.typeResolution) ? { typeResolution: candidate.typeResolution as DiagnosisSession["typeResolution"] } : {}),
    ...(isRecord(candidate.comparisonResolution) ? { comparisonResolution: candidate.comparisonResolution as DiagnosisSession["comparisonResolution"] } : {}),
    ...(Array.isArray(candidate.questionHistory) ? { questionHistory: candidate.questionHistory as DiagnosisSession["questionHistory"] } : {}),
    ...(Array.isArray(candidate.invalidatedAnswerQuestionIds) && candidate.invalidatedAnswerQuestionIds.every((id) => typeof id === "string")
      ? { invalidatedAnswerQuestionIds: candidate.invalidatedAnswerQuestionIds }
      : {}),
  };
}

function diagnosisSnapshot(session: DiagnosisSession): Record<string, unknown> {
  const { freeReport: _freeReport, completionConfirmation: _completionConfirmation, ...snapshot } = session;
  return snapshot;
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

function runtimeDependencies(env: Env): ResultsDependencies {
  const secret = env.REPORT_ACCESS_TOKEN_SECRET?.trim();
  if (!secret) throw new Error("purchase-configuration-incomplete");
  return {
    store: createFirestoreResultStore(env),
    createAccessToken: createReportAccessToken,
    accessTokenHash: async (accessToken) => await accessTokenHashHex(accessToken, secret),
  };
}

export async function resultsResponse(request: Request, env: Env, dependencies?: ResultsDependencies): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!purchaseConfigurationIsComplete(env)) return purchaseUnavailableResponse();
  let finished: DiagnosisSession;
  try {
    const session = sessionFrom(await readRequestJson(request));
    if (!session) return jsonResponse(400, { error: INVALID_RESULT_REQUEST });
    finished = finishDiagnosis(session);
    if (!finished.freeReport || finished.currentQuestionIds.length) return jsonResponse(400, { error: INCOMPLETE_DIAGNOSIS });
  } catch {
    return jsonResponse(400, { error: INVALID_RESULT_REQUEST });
  }
  try {
    const activeDependencies = dependencies ?? runtimeDependencies(env);
    const accessToken = activeDependencies.createAccessToken();
    const seed: ResultSeed = {
      sessionId: finished.sessionId,
      diagnosisSnapshot: diagnosisSnapshot(finished),
      accessTokenHash: await activeDependencies.accessTokenHash(accessToken),
      reportTemplateVersion: finished.versions.reportTemplateVersion,
    };
    const stored = await activeDependencies.store.findOrCreate(seed);
    if (!stored.tokenUsable) return jsonResponse(409, { error: "この診断結果は現在登録できません。専用URLまたは購入後の画面をご確認ください。" });
    return jsonResponse(201, { resultId: stored.id, accessToken });
  } catch {
    return jsonResponse(500, { error: RESULTS_UNAVAILABLE });
  }
}
