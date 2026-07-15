import { PUBLIC_SALES_CONFIG } from "../public-sales-config";

export const legalLinks = {
  terms: "/terms",
  privacy: "/privacy",
  commercialTransactions: "/legal",
  contact: `mailto:${PUBLIC_SALES_CONFIG.contactEmail}`,
} as const;
