export interface Env {
  ASSETS: Fetcher;
  STRIPE_SALE_PRICE_MODE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_LAUNCH_PRICE_ID?: string;
  STRIPE_REGULAR_PRICE_ID?: string;
  PUBLIC_APP_URL?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  REPORT_ACCESS_TOKEN_SECRET?: string;
  LEGAL_SELLER_NAME?: string;
  LEGAL_RESPONSIBLE_PERSON?: string;
  LEGAL_ADDRESS?: string;
  LEGAL_PHONE?: string;
  LEGAL_CONTACT_EMAIL?: string;
  LEGAL_SUPPORT_HOURS?: string;
  LEGAL_EFFECTIVE_DATE?: string;
  SERVICE_NAME?: string;
  DIAGNOSIS_NAME?: string;
  PAID_PRODUCT_NAME?: string;
  MAIN_TYPE_NAMES?: string;
  SUBTYPE_NAMES?: string;
}

export type EnvironmentVariable = Exclude<keyof Env, "ASSETS">;
