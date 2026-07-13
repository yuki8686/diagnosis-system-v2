import { firestore } from "./_lib/firebase";
import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "./_lib/http";
import { isUnexpired, type StoredDiagnosisResult } from "./_lib/result";
import { checkoutRequest } from "./_lib/checkout";
import { readJson } from "./_lib/http";
import { matchesAccessTokenHash } from "./_lib/token";

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== "POST") return methodNotAllowed(response);
  try {
    const input = checkoutRequest(await readJson(request, 4_096));
    if (!input) return json(response, 400, { error: "購入状況を確認できませんでした。" });
    const snapshot = await firestore().collection("diagnosisResults").doc(input.resultId).get();
    if (!snapshot.exists) return json(response, 404, { error: "購入状況を確認できませんでした。" });
    const result = snapshot.data() as StoredDiagnosisResult;
    if (!matchesAccessTokenHash(input.accessToken, result.accessTokenHash)) return json(response, 404, { error: "購入状況を確認できませんでした。" });
    return json(response, 200, { status: isUnexpired(result) ? result.status : "expired" });
  } catch { return json(response, 500, { error: "購入状況を確認できませんでした。" }); }
}
