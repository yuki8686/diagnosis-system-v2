import type { Env } from "./env";
import type { CheckoutInput, ExpectedCheckout, FetchImplementation } from "./firestore";

const MAX_STRIPE_RESPONSE_BYTES = 64 * 1024;

export interface StripeCheckoutGateway {
  verifyActivePrice(expected: ExpectedCheckout): Promise<void>;
  createCheckoutSession(input: CheckoutInput, expected: ExpectedCheckout): Promise<{ id: string; url: string }>;
}

class StripeRequestError extends Error {
  constructor() {
    super("stripe-request-failed");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readStripeJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_STRIPE_RESPONSE_BYTES) throw new StripeRequestError();
  const reader = response.body?.getReader();
  if (!reader) throw new StripeRequestError();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_STRIPE_RESPONSE_BYTES) {
        await reader.cancel();
        throw new StripeRequestError();
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
    throw new StripeRequestError();
  }
}

function checkoutUrlIsValid(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "checkout.stripe.com" || url.hostname.endsWith(".stripe.com"));
  } catch {
    return false;
  }
}

function stripeAuthorization(secretKey: string): string {
  return `Basic ${btoa(`${secretKey}:`)}`;
}

export function createStripeCheckoutGateway(env: Env, fetchImplementation: FetchImplementation = fetch): StripeCheckoutGateway {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const appUrl = env.PUBLIC_APP_URL?.trim();
  const paidProductName = env.PAID_PRODUCT_NAME?.trim();
  if (!secretKey || !appUrl || !paidProductName) throw new StripeRequestError();
  const headers = { Authorization: stripeAuthorization(secretKey) };

  async function stripeRequest(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImplementation(url, { ...init, headers: { ...headers, ...init.headers } });
    } catch {
      throw new StripeRequestError();
    }
    if (!response.ok) throw new StripeRequestError();
    return await readStripeJson(response);
  }

  return {
    async verifyActivePrice(expected): Promise<void> {
      const price = await stripeRequest(`https://api.stripe.com/v1/prices/${encodeURIComponent(expected.priceId)}?expand[]=product`, { method: "GET" });
      if (!isRecord(price)
        || price.id !== expected.priceId
        || price.type !== "one_time"
        || price.currency !== expected.currency
        || price.unit_amount !== expected.amount
        || !isRecord(price.product)
        || price.product.name !== paidProductName) throw new StripeRequestError();
    },
    async createCheckoutSession(input, expected): Promise<{ id: string; url: string }> {
      const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][price]": expected.priceId,
        "line_items[0][quantity]": "1",
        success_url: `${appUrl}/?checkout=success&resultId=${encodeURIComponent(input.resultId)}`,
        cancel_url: `${appUrl}/?checkout=cancelled&resultId=${encodeURIComponent(input.resultId)}`,
        "metadata[resultId]": input.resultId,
      });
      const session = await stripeRequest("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!isRecord(session)
        || typeof session.id !== "string"
        || typeof session.url !== "string"
        || !checkoutUrlIsValid(session.url)) throw new StripeRequestError();
      return { id: session.id, url: session.url };
    },
  };
}
