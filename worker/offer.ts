import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";
import type { Env, EnvironmentVariable } from "./env";

const PURCHASE_PREPARING_MESSAGE = "有料レポートは現在準備中です。販売開始までお待ちください。";

const legalFields = [
  "LEGAL_SELLER_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
  "LEGAL_CONTACT_EMAIL",
  "LEGAL_SUPPORT_HOURS",
  "LEGAL_EFFECTIVE_DATE",
] as const satisfies readonly EnvironmentVariable[];

const salesNameFields = [
  "SERVICE_NAME",
  "DIAGNOSIS_NAME",
  "PAID_PRODUCT_NAME",
  "MAIN_TYPE_NAMES",
  "SUBTYPE_NAMES",
] as const satisfies readonly EnvironmentVariable[];

const infrastructureFields = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PUBLIC_APP_URL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "REPORT_ACCESS_TOKEN_SECRET",
] as const satisfies readonly EnvironmentVariable[];

export interface PublicOffer {
  regularPriceYen: number;
  activePriceYen: number;
  activeLabel: "サービス開始記念価格" | "通常価格";
  purchaseAvailable: boolean;
  purchaseStatus: "available" | "preparing";
  purchaseMessage: string;
}

function hasValue(env: Env, name: EnvironmentVariable): boolean {
  return Boolean(env[name]?.trim());
}

function legalConfigurationIsComplete(env: Env): boolean {
  if (!legalFields.every((name) => hasValue(env, name))) return false;
  if (env.LEGAL_CONTACT_EMAIL?.trim().toLowerCase() !== PUBLIC_SALES_CONFIG.contactEmail) return false;
  const effectiveDate = env.LEGAL_EFFECTIVE_DATE?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) && !Number.isNaN(Date.parse(`${effectiveDate}T00:00:00Z`));
}

function salesNamesAreFinal(env: Env): boolean {
  return salesNameFields.every((name) => hasValue(env, name))
    && env.SERVICE_NAME?.trim() === PUBLIC_SALES_CONFIG.diagnosisName
    && env.DIAGNOSIS_NAME?.trim() === PUBLIC_SALES_CONFIG.diagnosisName
    && env.PAID_PRODUCT_NAME?.trim() === PUBLIC_SALES_CONFIG.paidProductName;
}

function configuredPublicAppUrlIsValid(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "https:" || (localDevelopment && url.protocol === "http:");
  } catch {
    return false;
  }
}

export function purchaseConfigurationIsComplete(env: Env): boolean {
  const activePriceId: EnvironmentVariable = env.STRIPE_SALE_PRICE_MODE === "regular"
    ? "STRIPE_REGULAR_PRICE_ID"
    : "STRIPE_LAUNCH_PRICE_ID";
  if (![...infrastructureFields, activePriceId].every((name) => hasValue(env, name))) return false;
  if ((env.REPORT_ACCESS_TOKEN_SECRET?.trim().length ?? 0) < 32) return false;
  return configuredPublicAppUrlIsValid(env.PUBLIC_APP_URL)
    && legalConfigurationIsComplete(env)
    && salesNamesAreFinal(env);
}

export function createPublicOffer(env: Env): PublicOffer {
  const regularMode = env.STRIPE_SALE_PRICE_MODE === "regular";
  const purchaseAvailable = purchaseConfigurationIsComplete(env);
  return {
    regularPriceYen: PUBLIC_SALES_CONFIG.regularPriceYen,
    activePriceYen: regularMode ? PUBLIC_SALES_CONFIG.regularPriceYen : PUBLIC_SALES_CONFIG.launchPriceYen,
    activeLabel: regularMode ? "通常価格" : "サービス開始記念価格",
    purchaseAvailable,
    purchaseStatus: purchaseAvailable ? "available" : "preparing",
    purchaseMessage: purchaseAvailable ? "有料レポートの購入手続きを開始できます。" : PURCHASE_PREPARING_MESSAGE,
  };
}

export function offerResponse(env: Env): Response {
  return new Response(JSON.stringify(createPublicOffer(env)), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
