import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";
import type { Env } from "./env";
import {
  createFirestoreCheckoutStore,
  type CheckoutInput,
  type CheckoutReservation,
  type CheckoutStore,
  type ExpectedCheckout,
} from "./firestore";
import { purchaseConfigurationIsComplete } from "./offer";
import { createStripeCheckoutGateway, type StripeCheckoutGateway } from "./stripe";

const MAX_REQUEST_BYTES = 4_096;
const PURCHASE_TARGET_ERROR = "購入対象を確認できませんでした。";
const PURCHASE_START_ERROR = "購入手続きを開始できませんでした。時間をおいてもう一度お試しください。";

export interface CheckoutDependencies {
  store: CheckoutStore;
  stripe: StripeCheckoutGateway;
}

function jsonResponse(status: number, value: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function purchaseUnavailableResponse(): Response {
  return jsonResponse(503, {
    code: "purchase_unavailable",
    error: "有料レポートは現在準備中です。販売開始までお待ちください。",
    purchaseAvailable: false,
    purchaseStatus: "preparing",
  }, { "Cache-Control": "no-store" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function checkoutRequest(value: unknown): CheckoutInput | undefined {
  if (!isRecord(value)) return undefined;
  const resultId = value.resultId;
  const accessToken = value.accessToken;
  if (typeof resultId !== "string" || !/^[0-9a-f-]{36}$/iu.test(resultId)) return undefined;
  if (typeof accessToken !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(accessToken)) return undefined;
  return { resultId, accessToken };
}

async function readRequestJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) throw new Error("request-too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("request-body-missing");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("request-too-large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("invalid-json");
  }
}

function expectedCheckout(env: Env): ExpectedCheckout {
  const regularMode = env.STRIPE_SALE_PRICE_MODE === "regular";
  const priceId = regularMode ? env.STRIPE_REGULAR_PRICE_ID?.trim() : env.STRIPE_LAUNCH_PRICE_ID?.trim();
  if (!priceId) throw new Error("purchase-configuration-incomplete");
  return {
    priceId,
    amount: regularMode ? PUBLIC_SALES_CONFIG.regularPriceYen : PUBLIC_SALES_CONFIG.launchPriceYen,
    currency: "jpy",
  };
}

function runtimeDependencies(env: Env): CheckoutDependencies {
  return {
    store: createFirestoreCheckoutStore(env),
    stripe: createStripeCheckoutGateway(env),
  };
}

export async function checkoutResponse(request: Request, env: Env, dependencies?: CheckoutDependencies): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!purchaseConfigurationIsComplete(env)) return purchaseUnavailableResponse();
  let reservation: CheckoutReservation | undefined;
  let activeDependencies: CheckoutDependencies | undefined;
  try {
    const input = checkoutRequest(await readRequestJson(request));
    if (!input) return jsonResponse(400, { error: PURCHASE_TARGET_ERROR });
    const expected = expectedCheckout(env);
    activeDependencies = dependencies ?? runtimeDependencies(env);
    reservation = await activeDependencies.store.reserve(input, expected);
    await activeDependencies.stripe.verifyActivePrice(expected);
    const session = await activeDependencies.stripe.createCheckoutSession(input, expected);
    await activeDependencies.store.saveCheckoutSession(reservation, session.id);
    return jsonResponse(200, { checkoutUrl: session.url });
  } catch {
    if (reservation && activeDependencies) await activeDependencies.store.markCheckoutFailed(reservation).catch(() => undefined);
    return jsonResponse(500, { error: PURCHASE_START_ERROR });
  }
}
