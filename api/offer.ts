import { ACTIVE_OFFER } from "./_lib/commerce";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";
import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "./_lib/http";
import { publicPurchaseAvailability } from "./_lib/purchase-availability";

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response);
  const mode = ACTIVE_OFFER.mode();
  return json(response, 200, {
    regularPriceYen: PUBLIC_SALES_CONFIG.regularPriceYen,
    activePriceYen: ACTIVE_OFFER.amount(),
    activeLabel: mode === "launch" ? "サービス開始記念価格" : "通常価格",
    ...publicPurchaseAvailability(),
  }, { "Cache-Control": "no-store" });
}
