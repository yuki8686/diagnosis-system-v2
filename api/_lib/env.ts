import { hasNonBlankValue, legalConfigurationIsComplete as legalConfigurationIsCompleteForDisclosure, type LegalDisclosureValues } from "../../src/sales-configuration";

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

type EnvironmentValues = Record<string, string | undefined> & LegalDisclosureValues;

export function legalConfigurationIsComplete(values: EnvironmentValues): boolean {
  return legalConfigurationIsCompleteForDisclosure(values);
}

export function legalConfigurationComplete(): boolean {
  return legalConfigurationIsComplete(process.env);
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
  if (!infrastructureFields.every((name) => hasNonBlankValue(values[name]))) return false;
  if ((values.REPORT_ACCESS_TOKEN_SECRET?.trim().length ?? 0) < 32) return false;
  try {
    const appUrl = new URL(values.PUBLIC_APP_URL!);
    const localDevelopment = appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1";
    if (appUrl.protocol !== "https:" && !(localDevelopment && appUrl.protocol === "http:")) return false;
  } catch {
    return false;
  }
  return legalConfigurationIsComplete(values);
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
