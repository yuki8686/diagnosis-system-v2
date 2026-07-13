import { useEffect, useState } from "react";
import { formatYen, paidProductPresentation } from "../product-config";

interface LegalDetails {
  configured: boolean;
  sellerName?: string;
  responsiblePerson?: string;
  address?: string;
  phone?: string;
  contactEmail?: string;
  supportHours?: string;
  serviceName?: string;
  diagnosisName?: string;
  productName?: string;
}

export function LegalNoticePage() {
  const [details, setDetails] = useState<LegalDetails>({ configured: false });
  useEffect(() => { void fetch("/api/legal").then((response) => response.json()).then((value: unknown) => { if (value && typeof value === "object" && "configured" in value) setDetails(value as LegalDetails); }).catch(() => undefined); }, []);
  const unknown = <span>公開準備中（本番決済開始前に設定必須）</span>;
  return <main className="screen active result-page"><div className="shell result-wrap"><header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>INNER NOTE</div><a className="linkbtn" href="/">診断ページへ戻る</a></header><section className="result-section" aria-labelledby="legal-title"><p className="eyebrow">LEGAL NOTICE</p><h1 id="legal-title">特定商取引法に基づく表記</h1><dl className="legal-list">
    <dt>販売事業者</dt><dd>{details.configured ? details.sellerName : unknown}</dd>
    <dt>サービス名</dt><dd>{details.serviceName || unknown}</dd>
    <dt>診断名</dt><dd>{details.diagnosisName || unknown}</dd>
    <dt>商品名</dt><dd>{details.productName || unknown}</dd>
    <dt>運営責任者</dt><dd>{details.configured ? details.responsiblePerson : unknown}</dd>
    <dt>所在地</dt><dd>{details.configured ? details.address : unknown}</dd>
    <dt>電話番号</dt><dd>{details.configured ? details.phone : unknown}</dd>
    <dt>問い合わせ先</dt><dd>{details.configured ? details.contactEmail : unknown}</dd>
    <dt>問い合わせ対応時間</dt><dd>{details.configured ? details.supportHours : unknown}</dd>
    <dt>販売価格</dt><dd>通常価格 {formatYen(paidProductPresentation.regularPriceYen)}（税込）／{paidProductPresentation.launchPriceLabel} {formatYen(paidProductPresentation.launchPriceYen)}（税込）</dd>
    <dt>支払方法</dt><dd>Stripe Checkoutによる一回払い</dd>
    <dt>提供時期</dt><dd>決済完了後、通常は直ちに専用閲覧ページで提供します。処理状況により数分かかる場合があります。</dd>
    <dt>返品・キャンセル</dt><dd>デジタルコンテンツの性質上、提供開始後の返品・キャンセルおよび返金は原則として受け付けません。ただし、重複決済、当サービス側の不具合により閲覧できない場合、その他当方が必要と判断した場合は個別に対応します。</dd>
    <dt>再閲覧期限</dt><dd>購入日から180日間</dd>
  </dl></section></div></main>;
}
