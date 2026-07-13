/**
 * Display copy only. The server validates the actual Checkout Price before it
 * creates a session; these values never determine a charge.
 */
export const paidProductPresentation = {
  candidateName: "あなた専用の詳しい診断レポート",
  nameStatus: "draft" as const,
  currency: "JPY" as const,
  regularPriceYen: 1980,
  launchPriceYen: 980,
  launchPriceLabel: "サービス開始記念価格",
  taxLabel: "税込",
} as const;

export function formatYen(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
}
