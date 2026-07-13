import { finishDiagnosis } from "../src/ui/engine";
import { versionsMatch, type DiagnosisSession } from "../src/ui/session";
import { accessTokenHash, reportAccessToken } from "./_lib/token";
import { json, methodNotAllowed, readJson, type ApiRequest, type ApiResponse } from "./_lib/http";
import { findOrCreateResult } from "./_lib/result";

function sessionFrom(value: unknown): DiagnosisSession | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as { session?: unknown }).session;
  if (!candidate || typeof candidate !== "object") return undefined;
  const session = candidate as Partial<DiagnosisSession>;
  return typeof session.sessionId === "string" && typeof session.sessionSeed === "string" && Array.isArray(session.answers) && versionsMatch(session) ? session as DiagnosisSession : undefined;
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response);
  try {
    const session = sessionFrom(await readJson(request));
    if (!session) return json(response, 400, { error: "診断結果を準備できませんでした。診断結果画面を開き直してください。" });
    const finished = finishDiagnosis(session);
    if (!finished.freeReport || finished.currentQuestionIds.length) return json(response, 400, { error: "診断が完了していません。" });
    const accessToken = reportAccessToken();
    const stored = await findOrCreateResult(finished, accessTokenHash(accessToken));
    if (!stored.tokenUsable) return json(response, 409, { error: "この診断結果は現在登録できません。専用URLまたは購入後の画面をご確認ください。" });
    return json(response, 201, { resultId: stored.id, accessToken });
  } catch {
    return json(response, 500, { error: "診断結果を準備できませんでした。時間をおいてもう一度お試しください。" });
  }
}
