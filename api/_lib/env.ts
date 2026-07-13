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

const legalFields = ["LEGAL_SELLER_NAME", "LEGAL_RESPONSIBLE_PERSON", "LEGAL_ADDRESS", "LEGAL_PHONE", "LEGAL_CONTACT_EMAIL", "LEGAL_SUPPORT_HOURS"] as const;

export function legalConfigurationIsComplete(values: Record<string, string | undefined>): boolean {
  return legalFields.every((name) => Boolean(values[name]));
}

export function legalConfigurationComplete(): boolean {
  return legalConfigurationIsComplete(process.env);
}

/** Used by release checks; deliberately separate from development scaffolding. */
export function salesReleaseConfigurationComplete(): boolean {
  return legalConfigurationComplete() && ["SERVICE_NAME", "DIAGNOSIS_NAME", "PAID_PRODUCT_NAME", "MAIN_TYPE_NAMES", "SUBTYPE_NAMES"].every((name) => Boolean(process.env[name]));
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
