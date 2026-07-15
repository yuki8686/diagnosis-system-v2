import { PUBLIC_SALES_CONFIG } from "../../src/public-sales-config";

const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_LAUNCH_PRICE_ID", "STRIPE_REGULAR_PRICE_ID", "PUBLIC_APP_URL", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "REPORT_ACCESS_TOKEN_SECRET"] as const;
type RequiredEnvironment = (typeof required)[number];

export function environment(name: RequiredEnvironment): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export function reportAccessTokenSecret(): string {
  const value = environment("REPORT_ACCESS_TOKEN_SECRET");
  if (value.length < 32) throw new Error("REPORT_ACCESS_TOKEN_SECRET must contain at least 32 characters");
  return value;
}

const legalFields = ["LEGAL_SELLER_NAME", "LEGAL_RESPONSIBLE_PERSON", "LEGAL_ADDRESS", "LEGAL_PHONE", "LEGAL_CONTACT_EMAIL", "LEGAL_SUPPORT_HOURS", "LEGAL_EFFECTIVE_DATE"] as const;
const salesNameFields = ["SERVICE_NAME", "DIAGNOSIS_NAME", "PAID_PRODUCT_NAME", "MAIN_TYPE_NAMES", "SUBTYPE_NAMES"] as const;

type EnvironmentValues = Record<string, string | undefined>;

function hasEnvironmentValue(values: EnvironmentValues, name: string): boolean {
  return Boolean(values[name]?.trim());
}

export function legalConfigurationIsComplete(values: EnvironmentValues): boolean {
  if (!legalFields.every((name) => hasEnvironmentValue(values, name))) return false;
  if (values.LEGAL_CONTACT_EMAIL?.trim().toLowerCase() !== PUBLIC_SALES_CONFIG.contactEmail) return false;
  const effectiveDate = values.LEGAL_EFFECTIVE_DATE?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) && !Number.isNaN(Date.parse(`${effectiveDate}T00:00:00Z`));
}

export function legalConfigurationComplete(): boolean {
  return legalConfigurationIsComplete(process.env);
}

/** Used by release checks; deliberately separate from development scaffolding. */
export function salesReleaseConfigurationComplete(): boolean {
  return legalConfigurationComplete() && salesNamesAreFinal(process.env);
}

function salesNamesAreFinal(values: EnvironmentValues): boolean {
  return salesNameFields.every((name) => hasEnvironmentValue(values, name))
    && values.SERVICE_NAME?.trim() === PUBLIC_SALES_CONFIG.diagnosisName
    && values.DIAGNOSIS_NAME?.trim() === PUBLIC_SALES_CONFIG.diagnosisName
    && values.PAID_PRODUCT_NAME?.trim() === PUBLIC_SALES_CONFIG.paidProductName;
}

export function purchaseConfigurationIsComplete(values: EnvironmentValues = process.env): boolean {
  const activePriceId = values.STRIPE_SALE_PRICE_MODE === "regular" ? "STRIPE_REGULAR_PRICE_ID" : "STRIPE_LAUNCH_PRICE_ID";
  const infrastructureFields = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    activePriceId,
    "PUBLIC_APP_URL",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "REPORT_ACCESS_TOKEN_SECRET",
  ];
  if (!infrastructureFields.every((name) => hasEnvironmentValue(values, name))) return false;
  if ((values.REPORT_ACCESS_TOKEN_SECRET?.trim().length ?? 0) < 32) return false;
  try {
    const appUrl = new URL(values.PUBLIC_APP_URL!);
    const localDevelopment = appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1";
    if (appUrl.protocol !== "https:" && !(localDevelopment && appUrl.protocol === "http:")) return false;
  } catch {
    return false;
  }
  return legalConfigurationIsComplete(values) && salesNamesAreFinal(values);
}

export function isProductionEnvironment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function publicAppUrl(): string {
  const configured = new URL(environment("PUBLIC_APP_URL"));
  const localDevelopment = configured.hostname === "localhost" || configured.hostname === "127.0.0.1";
  if (configured.protocol !== "https:" && !(localDevelopment && configured.protocol === "http:")) throw new Error("PUBLIC_APP_URL must use HTTPS");
  configured.pathname = configured.pathname.replace(/\/$/, "");
  configured.search = "";
  configured.hash = "";
  return configured.toString().replace(/\/$/, "");
}
