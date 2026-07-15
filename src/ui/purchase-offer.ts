import { paidProductPresentation } from "./product-config";

export const PURCHASE_PREPARING_COPY = "有料レポートは現在準備中です。販売開始までお待ちください。";

export interface PurchaseOfferViewModel {
  activePriceYen: number;
  activeLabel: string;
  purchaseAvailable: boolean;
  purchaseStatus: "available" | "preparing";
  purchaseMessage: string;
}

export function purchaseOfferViewModel(value: unknown): PurchaseOfferViewModel {
  const fallback: PurchaseOfferViewModel = {
    activePriceYen: paidProductPresentation.launchPriceYen,
    activeLabel: paidProductPresentation.launchPriceLabel,
    purchaseAvailable: false,
    purchaseStatus: "preparing",
    purchaseMessage: PURCHASE_PREPARING_COPY,
  };
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  const price = typeof candidate.activePriceYen === "number" && Number.isFinite(candidate.activePriceYen) && candidate.activePriceYen > 0
    ? candidate.activePriceYen
    : fallback.activePriceYen;
  const label = typeof candidate.activeLabel === "string" && candidate.activeLabel.trim() ? candidate.activeLabel : fallback.activeLabel;
  if (candidate.purchaseAvailable !== true || candidate.purchaseStatus !== "available") {
    return { ...fallback, activePriceYen: price, activeLabel: label };
  }
  return {
    activePriceYen: price,
    activeLabel: label,
    purchaseAvailable: true,
    purchaseStatus: "available",
    purchaseMessage: typeof candidate.purchaseMessage === "string" && candidate.purchaseMessage.trim()
      ? candidate.purchaseMessage
      : "有料レポートの購入手続きを開始できます。",
  };
}

export function canStartCheckout(offer: PurchaseOfferViewModel, isStarting: boolean, hasAcceptedTerms: boolean): boolean {
  return offer.purchaseAvailable && offer.purchaseStatus === "available" && hasAcceptedTerms && !isStarting;
}
