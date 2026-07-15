import { useEffect, useState, type RefObject } from "react";
import { PUBLIC_SALES_CONFIG } from "../../public-sales-config";
import { legalLinks } from "../legal-links";
import { lockedReportOffer } from "../locked-report";
import { formatYen, paidProductPresentation } from "../product-config";
import { canStartCheckout, purchaseOfferViewModel } from "../purchase-offer";

export function PaidReportOffer({ offerRef, isStarting, error, onStartCheckout }: { offerRef: RefObject<HTMLElement | null>; isStarting: boolean; error?: string; onStartCheckout: () => void }) {
  const [offer, setOffer] = useState(() => purchaseOfferViewModel(undefined));
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/offer")
      .then((response) => response.ok ? response.json() : undefined)
      .then((value: unknown) => { if (active) setOffer(purchaseOfferViewModel(value)); })
      .catch(() => { if (active) setOffer(purchaseOfferViewModel(undefined)); });
    return () => { active = false; };
  }, []);
  const checkoutAllowed = canStartCheckout(offer, isStarting, hasAcceptedTerms);
  const startCheckout = () => { if (checkoutAllowed) onStartCheckout(); };
  return <section ref={offerRef} id="paid-report-offer" className="result-section paid-card" tabIndex={-1} aria-labelledby="paid-report-offer-title">
    <p className="eyebrow">{lockedReportOffer.eyebrow}</p>
    <h2 id="paid-report-offer-title">{lockedReportOffer.title}</h2>
    <p>{lockedReportOffer.body}</p>
    <p className="paid-product-name">商品名：{PUBLIC_SALES_CONFIG.paidProductName}</p>
    <p className="price-note"><s>通常価格 {formatYen(paidProductPresentation.regularPriceYen)}（{paidProductPresentation.taxLabel}）</s><br/><strong>{offer.activeLabel} {formatYen(offer.activePriceYen)}（{paidProductPresentation.taxLabel}）</strong></p>
    <p className="launch-offer-notice">{PUBLIC_SALES_CONFIG.launchOfferNotice}</p>
    <ul className="purchase-conditions">
      <li>Stripeの決済画面に表示される支払方法をご利用いただけます。</li>
      <li>決済確認後、原則として即時に専用閲覧URLを発行します。</li>
      <li>閲覧期限は購入完了日から{PUBLIC_SALES_CONFIG.reportAccessDays}日間です。</li>
      <li>閲覧URLの第三者への共有、譲渡、転載、販売または公開は禁止です。</li>
      <li>デジタルコンテンツのため、購入者都合によるキャンセルおよび返金は受け付けません。</li>
      <li>重複決済、運営者の責めに帰すべき事由による提供不能、その他運営者が相当と判断した場合は返金対応します。</li>
    </ul>
    <p className="purchase-state-note">{offer.purchaseAvailable ? <>現在適用される請求額は {formatYen(offer.activePriceYen)}（{paidProductPresentation.taxLabel}）です。</> : offer.purchaseMessage}</p>
    <label className="purchase-consent"><input type="checkbox" checked={hasAcceptedTerms} disabled={!offer.purchaseAvailable || isStarting} onChange={(event) => setHasAcceptedTerms(event.currentTarget.checked)}/><span><a href={legalLinks.terms}>利用規約</a>、<a href={legalLinks.privacy}>プライバシーポリシー</a>、<a href={legalLinks.commercialTransactions}>特定商取引法に基づく表記</a>、キャンセル・返金条件を確認し、同意します。</span></label>
    <div className="paid-actions"><button type="button" className="primary" disabled={!checkoutAllowed} onClick={startCheckout}>{isStarting ? "購入手続きを準備しています…" : "詳細レポートを見る"}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
