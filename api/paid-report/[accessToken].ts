import { accessTokenHash } from "../_lib/token";
import { isAccessToken } from "../_lib/access-token";
import { firestore } from "../_lib/firebase";
import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "../_lib/http";
import { paidReportView } from "../_lib/report";
import { isUnexpired, type StoredDiagnosisResult } from "../_lib/result";
import type { PaidReport } from "../../src/types";

function tokenFrom(request: ApiRequest): string | undefined {
  const raw = request.query?.accessToken;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isAccessToken(value) ? value : undefined;
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response);
  try {
    const token = tokenFrom(request);
    if (!token) return json(response, 404, { error: "レポートを表示できません。" });
    const found = await firestore().collection("diagnosisResults").where("accessTokenHash", "==", accessTokenHash(token)).limit(1).get();
    if (found.empty) return json(response, 404, { error: "レポートを表示できません。" });
    const result = found.docs[0].data() as StoredDiagnosisResult;
    if (result.status !== "paid" || !result.paidReport || !isUnexpired(result)) return json(response, 404, { error: "レポートを表示できません。" });
    return json(response, 200, paidReportView(result.paidReport as PaidReport), { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  } catch { return json(response, 500, { error: "レポートを表示できません。時間をおいてもう一度お試しください。" }); }
}
