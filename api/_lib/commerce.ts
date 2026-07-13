import type Stripe from "stripe";
import { environment } from "./env";

/** Server-side source of truth for the currently active launch offer. */
export const ACTIVE_OFFER = {
  currency: "jpy" as const,
  mode: (): "launch" | "regular" => process.env.STRIPE_SALE_PRICE_MODE === "regular" ? "regular" : "launch",
  amount: (): number => process.env.STRIPE_SALE_PRICE_MODE === "regular" ? 1980 : 980,
  priceId: (): string => process.env.STRIPE_SALE_PRICE_MODE === "regular" ? environment("STRIPE_REGULAR_PRICE_ID") : environment("STRIPE_LAUNCH_PRICE_ID"),
};

export function isExpectedActivePrice(price: Pick<Stripe.Price, "id" | "currency" | "unit_amount" | "type">): boolean {
  return price.id === ACTIVE_OFFER.priceId()
    && price.type === "one_time"
    && price.currency === ACTIVE_OFFER.currency
    && price.unit_amount === ACTIVE_OFFER.amount();
}

export function isExpectedPaidCheckout(session: Pick<Stripe.Checkout.Session, "payment_status" | "currency" | "amount_total">, priceIds: string[]): boolean {
  return isExpectedStoredCheckout(session, priceIds, { priceId: ACTIVE_OFFER.priceId(), amount: ACTIVE_OFFER.amount(), currency: ACTIVE_OFFER.currency });
}

export interface ExpectedCheckout {
  priceId: string;
  amount: number;
  currency: string;
}

export function isExpectedStoredCheckout(session: Pick<Stripe.Checkout.Session, "payment_status" | "currency" | "amount_total">, priceIds: string[], expected: ExpectedCheckout): boolean {
  return session.payment_status === "paid"
    && session.currency === expected.currency
    && session.amount_total === expected.amount
    && priceIds.length === 1
    && priceIds[0] === expected.priceId;
}
