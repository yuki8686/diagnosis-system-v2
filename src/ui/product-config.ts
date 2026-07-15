import { PUBLIC_SALES_CONFIG } from "../public-sales-config";

/**
 * Display copy only. The server validates the actual Checkout Price before it
 * creates a session; these values never determine a charge.
 */
export const paidProductPresentation = {
  candidateName: PUBLIC_SALES_CONFIG.paidProductName,
  nameStatus: "confirmed" as const,
  currency: "JPY" as const,
  regularPriceYen: PUBLIC_SALES_CONFIG.regularPriceYen,
  launchPriceYen: PUBLIC_SALES_CONFIG.launchPriceYen,
  launchPriceLabel: "サービス開始記念価格",
  taxLabel: "税込",
} as const;

export function formatYen(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
}
