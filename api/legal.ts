import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "./_lib/http";
import { legalConfigurationComplete } from "./_lib/env";

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response);
  const effectiveDate = process.env.LEGAL_EFFECTIVE_DATE?.trim();
  return json(response, 200, {
    configured: legalConfigurationComplete(),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? "") ? { effectiveDate } : {}),
  }, { "Cache-Control": "no-store" });
}
