import { strict as assert } from "node:assert";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import checkoutHandler from "../api/checkout";
import { purchaseConfigurationIsComplete } from "../api/_lib/env";
import { publicPurchaseAvailability, PURCHASE_PREPARING_MESSAGE } from "../api/_lib/purchase-availability";
import type { ApiRequest, ApiResponse } from "../api/_lib/http";
import offerHandler from "../api/offer";
import { PUBLIC_SALES_CONFIG } from "../src/public-sales-config";
import { legalDisclosureConfigurationIsComplete } from "../src/sales-configuration";
import { LegalNoticePage } from "../src/ui/components/LegalNoticePage";
import { legalEffectiveDate } from "../src/ui/components/LegalDocumentDate";
import { PaidReportOffer } from "../src/ui/components/PaidReportOffer";
import { PrivacyPage } from "../src/ui/components/PrivacyPage";
import { PurchasePendingScreen } from "../src/ui/components/PurchasePendingScreen";
import { TermsPage } from "../src/ui/components/TermsPage";
import { legalLinks } from "../src/ui/legal-links";
import { canStartCheckout, purchaseOfferViewModel, PURCHASE_PREPARING_COPY } from "../src/ui/purchase-offer";
import { purchaseConfigurationIsComplete as workerPurchaseConfigurationIsComplete } from "../worker/offer";
import type { Env } from "../worker/env";

const completeEnvironment = {
  STRIPE_SECRET_KEY: "sk_test_not-a-real-secret",
  STRIPE_WEBHOOK_SECRET: "whsec_not-a-real-secret",
  STRIPE_LAUNCH_PRICE_ID: "price_launch_980",
  STRIPE_SALE_PRICE_MODE: "launch",
  PUBLIC_APP_URL: "https://diagnosis.example.test",
  FIREBASE_PROJECT_ID: "test-project",
  FIREBASE_CLIENT_EMAIL: "server@example.test",
  FIREBASE_PRIVATE_KEY: "not-a-real-private-key",
  REPORT_ACCESS_TOKEN_SECRET: "x".repeat(32),
  LEGAL_DISCLOSURE_MODE: "on-request",
  LEGAL_CONTACT_EMAIL: PUBLIC_SALES_CONFIG.contactEmail,
} satisfies Record<string, string>;

const requiredForLaunch = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_LAUNCH_PRICE_ID",
  "PUBLIC_APP_URL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "REPORT_ACCESS_TOKEN_SECRET",
  "LEGAL_DISCLOSURE_MODE",
  "LEGAL_CONTACT_EMAIL",
] as const;

assert.equal(purchaseConfigurationIsComplete(completeEnvironment), true, "complete launch sales configuration enables Checkout");
for (const name of requiredForLaunch) {
  assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, [name]: "" }), false, `${name} is required before Checkout can be enabled`);
}
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, PUBLIC_APP_URL: "http://public.example.test" }), false, "a public non-HTTPS app URL cannot enable Checkout");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, REPORT_ACCESS_TOKEN_SECRET: "too-short" }), false, "an insufficient access-token secret cannot enable Checkout");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, STRIPE_SALE_PRICE_MODE: "regular" }), false, "regular mode requires the regular Price ID");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, STRIPE_SALE_PRICE_MODE: "regular", STRIPE_REGULAR_PRICE_ID: "price_regular_1980" }), true, "regular mode uses its dedicated Price ID");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, LEGAL_SELLER_NAME: undefined, LEGAL_RESPONSIBLE_PERSON: undefined, LEGAL_ADDRESS: undefined, LEGAL_PHONE: undefined }), true, "on-request disclosure does not require undisclosed seller details");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, LEGAL_CONTACT_EMAIL: "" }), false, "on-request disclosure fails closed without the approved contact address");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, LEGAL_CONTACT_EMAIL: "other@example.test" }), false, "on-request disclosure fails closed when the contact address does not exactly match the public legal notice");
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, LEGAL_DISCLOSURE_MODE: "unknown" }), false, "unknown disclosure modes fail closed");
const publicDisclosure = {
  LEGAL_DISCLOSURE_MODE: "public",
  LEGAL_CONTACT_EMAIL: PUBLIC_SALES_CONFIG.contactEmail,
  LEGAL_SELLER_NAME: "seller",
  LEGAL_RESPONSIBLE_PERSON: "responsible",
  LEGAL_ADDRESS: "address",
  LEGAL_PHONE: "phone",
};
assert.equal(legalDisclosureConfigurationIsComplete(publicDisclosure, "public"), true, "public disclosure requires all seller details");
for (const name of ["LEGAL_SELLER_NAME", "LEGAL_RESPONSIBLE_PERSON", "LEGAL_ADDRESS", "LEGAL_PHONE"] as const) {
  for (const value of [undefined, "", "   "]) {
    assert.equal(legalDisclosureConfigurationIsComplete({ ...publicDisclosure, [name]: value }, "public"), false, `${name} cannot be missing or blank in public disclosure mode`);
  }
}
const testAssets: Env["ASSETS"] = {
  fetch: async () => new Response(),
  connect: () => { throw new Error("ASSETS.connect is not used by this test"); },
};
const completeWorkerEnvironment = {
  ASSETS: testAssets,
  ...completeEnvironment,
} satisfies Env;
const legacyEnvironmentValues = {
  LEGAL_SUPPORT_HOURS: "legacy hours",
  LEGAL_EFFECTIVE_DATE: "2026-07-19",
  SERVICE_NAME: "legacy service",
  DIAGNOSIS_NAME: "legacy diagnosis",
  PAID_PRODUCT_NAME: "legacy product",
  MAIN_TYPE_NAMES: "legacy main names",
  SUBTYPE_NAMES: "legacy subtype names",
};
assert.equal(purchaseConfigurationIsComplete({ ...completeEnvironment, ...legacyEnvironmentValues }), true, "retired legal and naming values do not affect Vercel purchase availability");
assert.equal(workerPurchaseConfigurationIsComplete({ ...completeWorkerEnvironment, ...legacyEnvironmentValues }), true, "retired legal and naming values do not affect Worker purchase availability");
for (const values of [
  completeEnvironment,
  { ...completeEnvironment, LEGAL_CONTACT_EMAIL: "" },
  { ...completeEnvironment, LEGAL_CONTACT_EMAIL: "other@example.test" },
  { ...completeEnvironment, LEGAL_DISCLOSURE_MODE: "unknown" },
]) {
  assert.equal(workerPurchaseConfigurationIsComplete({ ...completeWorkerEnvironment, ...values }), purchaseConfigurationIsComplete(values), "Worker and Vercel use the same legal-disclosure purchase-availability decision");
}

const unavailable = publicPurchaseAvailability({});
assert.deepEqual(unavailable, { purchaseAvailable: false, purchaseStatus: "preparing", purchaseMessage: PURCHASE_PREPARING_MESSAGE }, "missing server configuration is publicly reported only as preparing");
const failedOffer = purchaseOfferViewModel(undefined);
assert.equal(failedOffer.purchaseAvailable, false, "an offer API failure fails closed");
assert.equal(failedOffer.purchaseMessage, PURCHASE_PREPARING_COPY, "an offer API failure uses the safe preparing message");
let checkoutCalls = 0;
if (canStartCheckout(failedOffer, false, true)) checkoutCalls += 1;
assert.equal(checkoutCalls, 0, "the unavailable UI guard never calls Checkout");

const availableOffer = purchaseOfferViewModel({
  activePriceYen: 980,
  activeLabel: "サービス開始記念価格",
  purchaseAvailable: true,
  purchaseStatus: "available",
  purchaseMessage: "購入できます。",
});
assert.equal(canStartCheckout(availableOffer, false, false), false, "available server configuration cannot bypass purchase consent");
assert.equal(canStartCheckout(availableOffer, false, true), true, "complete availability and consent preserve the existing purchase path");
assert.equal(canStartCheckout(availableOffer, true, true), false, "the purchase path remains guarded during an in-flight request");

const preparingMarkup = renderToStaticMarkup(createElement(PaidReportOffer, {
  offerRef: createRef<HTMLElement>(),
  isStarting: false,
  onStartCheckout: () => { checkoutCalls += 1; },
}));
assert.match(preparingMarkup, /有料レポートは現在準備中/, "the initial fail-closed UI explains that paid reports are preparing");
assert.match(preparingMarkup, /disabled=""/, "the preparing purchase button is natively disabled");
assert.match(preparingMarkup, />詳細レポートを見る<\/button>/, "the normal CTA copy is the approved label even while disabled");
assert.doesNotMatch(preparingMarkup, /<button[^>]*>[^<]*(980|1,980)円/, "the CTA itself never contains a price");
assert.doesNotMatch(preparingMarkup, new RegExp(["詳しいレポートを", "購入する"].join("")), "the superseded purchase CTA is not rendered");
assert.match(preparingMarkup, /利用規約.*プライバシーポリシー.*特定商取引法に基づく表記.*キャンセル・返金条件/, "the purchase consent covers every required document and refund condition");
assert.doesNotMatch(preparingMarkup, /<p class="legal-links">/, "the CTA no longer renders the duplicate legal-link list below the button");
assert.equal(checkoutCalls, 0, "rendering an unavailable offer does not start Checkout");

assert.deepEqual(legalLinks, {
  terms: "/terms",
  privacy: "/privacy",
  commercialTransactions: "/legal",
  contact: `mailto:${PUBLIC_SALES_CONFIG.contactEmail}`,
}, "all footer legal and contact links resolve to real application routes");
assert.equal(Object.values(legalLinks).some((href) => String(href) === "#"), false, "no legal link is an inert hash link");

const legalMarkup = renderToStaticMarkup(createElement(LegalNoticePage));
const termsMarkup = renderToStaticMarkup(createElement(TermsPage));
const privacyMarkup = renderToStaticMarkup(createElement(PrivacyPage));
const pendingMarkup = renderToStaticMarkup(createElement(PurchasePendingScreen, {}));
for (const [name, markup] of [["commercial disclosure", legalMarkup], ["terms", termsMarkup], ["privacy policy", privacyMarkup]] as const) {
  assert.match(markup, new RegExp(PUBLIC_SALES_CONFIG.contactEmail), `${name} displays the approved contact address`);
  assert.doesNotMatch(markup, new RegExp(`${["公開", "準備中"].join("")}|${["正式本文は", "未公開"].join("")}`), `${name} contains no temporary publication copy`);
}
assert.match(legalMarkup, /本音キャラ診断 詳細レポート/, "the commercial disclosure uses the approved paid product name");
assert.equal(PUBLIC_SALES_CONFIG.legalDisclosureMode, "on-request", "the declared sale configuration uses the approved on-request disclosure policy");
assert.match(legalMarkup, /請求があった場合に遅滞なく電子メールにて提供/, "the commercial disclosure visibly explains the on-request seller-detail policy");
assert.match(legalMarkup, /980円/, "the launch price is disclosed");
assert.match(legalMarkup, /1,980円/, "the regular price is disclosed");
assert.match(legalMarkup, /予定販売件数に達し次第終了/, "the launch offer ending condition is disclosed without its internal target count");
assert.match(legalMarkup, /購入完了日から180日間/, "the commercial disclosure uses the 180-day access period");
assert.match(legalMarkup, /第三者への共有、譲渡、転載、販売または公開を禁止/, "the commercial disclosure prohibits sharing the access URL");
assert.match(legalMarkup, /購入者都合によるキャンセルおよび返金は受け付けません/, "the commercial disclosure states the customer cancellation rule");
assert.match(legalMarkup, /重複決済.*提供できない場合.*返金を相当と判断/, "the commercial disclosure states the refund exceptions");
assert.match(termsMarkup, /購入完了日から180日間/, "the terms use the same access period");
assert.match(privacyMarkup, /購入完了日から180日間/, "the privacy policy describes the paid report and token period");
assert.match(pendingMarkup, /購入完了日から180日間/, "the purchase confirmation screen uses the same access period");
assert.equal(legalEffectiveDate("2026-07-14"), "2026年7月14日", "the production enactment date can be supplied without a hard-coded placeholder");
assert.equal(legalEffectiveDate("not-a-date"), undefined, "invalid enactment dates are not displayed");

function responseRecorder() {
  const record: { status?: number; headers?: Record<string, string>; body?: string } = {};
  const response = {
    writeHead(status: number, headers: Record<string, string>) { record.status = status; record.headers = headers; return this; },
    end(body?: string) { record.body = body; return this; },
  } as unknown as ApiResponse;
  return { record, response };
}

const environmentKeys = Object.keys(completeEnvironment);
const previousEnvironment = Object.fromEntries(environmentKeys.map((name) => [name, process.env[name]]));
try {
  Object.assign(process.env, completeEnvironment);
  const offerResponse = responseRecorder();
  offerHandler({ method: "GET" } as ApiRequest, offerResponse.response);
  assert.equal(offerResponse.record.status, 200);
  const publicOffer = JSON.parse(offerResponse.record.body ?? "null") as Record<string, unknown>;
  assert.equal(publicOffer.purchaseAvailable, true, "the offer API exposes availability when configuration is complete");
  assert.deepEqual(Object.keys(publicOffer).sort(), ["activeLabel", "activePriceYen", "purchaseAvailable", "purchaseMessage", "purchaseStatus", "regularPriceYen"].sort(), "the offer API returns only its public contract");
  const serializedOffer = JSON.stringify(publicOffer);
  for (const secret of [completeEnvironment.STRIPE_SECRET_KEY, completeEnvironment.STRIPE_WEBHOOK_SECRET, completeEnvironment.FIREBASE_PRIVATE_KEY, completeEnvironment.REPORT_ACCESS_TOKEN_SECRET]) {
    assert.equal(serializedOffer.includes(secret), false, "the offer API never returns secret configuration values");
  }

  delete process.env.STRIPE_SECRET_KEY;
  const unavailableOfferResponse = responseRecorder();
  offerHandler({ method: "GET" } as ApiRequest, unavailableOfferResponse.response);
  const unavailablePublicOffer = JSON.parse(unavailableOfferResponse.record.body ?? "null") as Record<string, unknown>;
  assert.equal(unavailablePublicOffer.purchaseAvailable, false, "the offer API reports preparing when any required server setting is missing");
  assert.equal(unavailablePublicOffer.purchaseStatus, "preparing");
  assert.equal(JSON.stringify(unavailablePublicOffer).includes("STRIPE_SECRET_KEY"), false, "the offer API does not disclose which internal setting is missing");

  const checkoutResponse = responseRecorder();
  await checkoutHandler({ method: "POST", body: { resultId: "not-used", accessToken: "not-used" } } as ApiRequest, checkoutResponse.response);
  assert.equal(checkoutResponse.record.status, 503, "direct Checkout requests are rejected before external services when configuration is incomplete");
  assert.deepEqual(JSON.parse(checkoutResponse.record.body ?? "null"), {
    code: "purchase_unavailable",
    error: PURCHASE_PREPARING_MESSAGE,
    purchaseAvailable: false,
    purchaseStatus: "preparing",
  }, "Checkout returns a stable, non-sensitive preparing response");
} finally {
  for (const name of environmentKeys) {
    const previous = previousEnvironment[name];
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

console.log("purchase availability and fail-closed sales UI tests passed");
