import { useEffect, useState, type RefObject } from "react";
import { lockedReportOffer } from "../locked-report";
import { formatYen, paidProductPresentation } from "../product-config";

export function PaidReportOffer({ offerRef, isStarting, error, onStartCheckout }: { offerRef: RefObject<HTMLElement | null>; isStarting: boolean; error?: string; onStartCheckout: () => void }) {
  const [offer, setOffer] = useState<{ activePriceYen: number; activeLabel: string }>({ activePriceYen: paidProductPresentation.launchPriceYen, activeLabel: paidProductPresentation.launchPriceLabel });
  useEffect(() => { void fetch("/api/offer").then((response) => response.ok ? response.json() : undefined).then((value: unknown) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as { activePriceYen?: unknown; activeLabel?: unknown };
    if (typeof candidate.activePriceYen === "number" && typeof candidate.activeLabel === "string") setOffer({ activePriceYen: candidate.activePriceYen, activeLabel: candidate.activeLabel });
  }).catch(() => undefined); }, []);
  return <section ref={offerRef} id="paid-report-offer" className="result-section paid-card" tabIndex={-1} aria-labelledby="paid-report-offer-title">
    <p className="eyebrow">{lockedReportOffer.eyebrow}</p>
    <h2 id="paid-report-offer-title">{lockedReportOffer.title}</h2>
    <p>{lockedReportOffer.body}</p>
    <p className="price-note"><s>通常価格 {formatYen(paidProductPresentation.regularPriceYen)}（{paidProductPresentation.taxLabel}）</s><br/><strong>{offer.activeLabel} {formatYen(offer.activePriceYen)}（{paidProductPresentation.taxLabel}）</strong></p>
    <p className="purchase-state-note">現在適用される請求額は {formatYen(offer.activePriceYen)}（{paidProductPresentation.taxLabel}）です。Stripe Checkoutでお支払いに進みます。</p>
    <div className="paid-actions"><button type="button" className="primary" disabled={isStarting} onClick={onStartCheckout}>{isStarting ? "購入手続きを準備しています…" : "詳しいレポートを購入する"}</button></div>
    <p className="legal-links"><a href="/legal">特定商取引法に基づく表記</a><span aria-hidden="true"> / </span><a href="/terms">利用規約</a></p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
