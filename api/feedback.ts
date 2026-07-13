import { Timestamp } from "firebase-admin/firestore";
import { feedbackPayload } from "./_lib/feedback";
import { firestore } from "./_lib/firebase";
import { json, methodNotAllowed, readJson, type ApiRequest, type ApiResponse } from "./_lib/http";
import { type StoredDiagnosisResult } from "./_lib/result";
import { matchesAccessTokenHash } from "./_lib/token";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response);
  try {
    const feedback = feedbackPayload(await readJson(request, 8_192));
    if (!feedback) return json(response, 400, { error: "入力内容を確認してください。" });
    const db = firestore();
    const result = await db.collection("diagnosisResults").doc(feedback.resultId).get();
    if (!result.exists) return json(response, 404, { error: "診断結果を確認できませんでした。" });
    const stored = result.data() as StoredDiagnosisResult;
    if (!matchesAccessTokenHash(feedback.accessToken, stored.accessTokenHash)) return json(response, 404, { error: "診断結果を確認できませんでした。" });
    if (stored.feedbackExpiresAt.toMillis() <= Date.now()) return json(response, 410, { error: "この結果へのフィードバック受付期間は終了しました。" });
    const reference = db.collection("resultFeedback").doc(feedback.resultId);
    try { await reference.create({ version: 1, resultId: feedback.resultId, rating: feedback.rating, ...(feedback.comment ? { comment: feedback.comment } : {}), createdAt: Timestamp.now(), expiresAt: stored.feedbackExpiresAt }); }
    catch (caught) {
      const code = (caught as { code?: unknown } | undefined)?.code;
      if (code === 6 || code === "already-exists") return json(response, 409, { error: "この結果のフィードバックはすでに保存されています。" });
      throw caught;
    }
    return json(response, 201, { saved: true });
  } catch { return json(response, 500, { error: "フィードバックを保存できませんでした。時間をおいてもう一度お試しください。" }); }
}
