import Stripe from "stripe";
import { environment } from "./env";

let client: Stripe | undefined;
export function stripe(): Stripe { return client ??= new Stripe(environment("STRIPE_SECRET_KEY")); }
