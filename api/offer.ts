import { ACTIVE_OFFER } from "./_lib/commerce";
import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "./_lib/http";

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response);
  const mode = ACTIVE_OFFER.mode();
  return json(response, 200, { regularPriceYen: 1980, activePriceYen: ACTIVE_OFFER.amount(), activeLabel: mode === "launch" ? "サービス開始記念価格" : "通常価格", mode });
}
