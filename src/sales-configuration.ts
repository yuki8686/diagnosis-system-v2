import { PUBLIC_SALES_CONFIG } from "./public-sales-config";

export type LegalDisclosureMode = "public" | "on-request";

export interface LegalDisclosureValues {
  LEGAL_DISCLOSURE_MODE?: string;
  LEGAL_CONTACT_EMAIL?: string;
  LEGAL_SELLER_NAME?: string;
  LEGAL_RESPONSIBLE_PERSON?: string;
  LEGAL_ADDRESS?: string;
  LEGAL_PHONE?: string;
}

const publicSellerFields = [
  "LEGAL_SELLER_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
] as const;

export function hasNonBlankValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isLegalDisclosureMode(value: string | undefined): value is LegalDisclosureMode {
  return value === "public" || value === "on-request";
}

/**
 * Checks a selected disclosure mode against the values it requires.  Callers
 * pass the mode that the public legal notice actually declares, so an
 * environment setting cannot silently diverge from the customer-facing page.
 */
export function legalDisclosureConfigurationIsComplete(
  values: LegalDisclosureValues,
  expectedMode: LegalDisclosureMode,
): boolean {
  const selectedMode = values.LEGAL_DISCLOSURE_MODE?.trim();
  if (!isLegalDisclosureMode(selectedMode) || selectedMode !== expectedMode) return false;
  if (values.LEGAL_CONTACT_EMAIL?.trim() !== PUBLIC_SALES_CONFIG.contactEmail) return false;
  return selectedMode === "on-request" || publicSellerFields.every((name) => hasNonBlankValue(values[name]));
}

export function legalConfigurationIsComplete(values: LegalDisclosureValues): boolean {
  return legalDisclosureConfigurationIsComplete(values, PUBLIC_SALES_CONFIG.legalDisclosureMode);
}
