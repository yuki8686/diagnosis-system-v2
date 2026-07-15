import { purchaseConfigurationIsComplete } from "./env";

export const PURCHASE_PREPARING_MESSAGE = "有料レポートは現在準備中です。販売開始までお待ちください。";

export interface PublicPurchaseAvailability {
  purchaseAvailable: boolean;
  purchaseStatus: "available" | "preparing";
  purchaseMessage: string;
}

export function publicPurchaseAvailability(values: Record<string, string | undefined> = process.env): PublicPurchaseAvailability {
  if (!purchaseConfigurationIsComplete(values)) {
    return { purchaseAvailable: false, purchaseStatus: "preparing", purchaseMessage: PURCHASE_PREPARING_MESSAGE };
  }
  return { purchaseAvailable: true, purchaseStatus: "available", purchaseMessage: "有料レポートの購入手続きを開始できます。" };
}

export function purchaseUnavailableResponse() {
  return {
    code: "purchase_unavailable",
    error: PURCHASE_PREPARING_MESSAGE,
    purchaseAvailable: false,
    purchaseStatus: "preparing" as const,
  };
}
