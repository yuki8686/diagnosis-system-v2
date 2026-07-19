import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";
import { hasNonBlankValue, legalConfigurationIsComplete as legalConfigurationIsCompleteForDisclosure } from "../src/sales-configuration";
import type { Env, EnvironmentVariable } from "./env";

const PURCHASE_PREPARING_MESSAGE = "有料レポートは現在準備中です。販売開始までお待ちください。";

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
  return hasNonBlankValue(env[name]);
}

function legalConfigurationIsComplete(env: Env): boolean {
  return legalConfigurationIsCompleteForDisclosure(env);
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
    && legalConfigurationIsComplete(env);
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
