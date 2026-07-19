import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "./_lib/http";
import { legalConfigurationComplete } from "./_lib/env";

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response);
  return json(response, 200, {
    configured: legalConfigurationComplete(),
  }, { "Cache-Control": "no-store" });
}
