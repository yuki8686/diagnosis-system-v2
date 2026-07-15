import { legalLinks } from "../legal-links";

export function PurchasePendingScreen({ error }: { error?: string }) {
  return <main className="screen active result-page"><div className="shell result-wrap"><header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>本音キャラ診断</div></header><section className="result-section" aria-live="polite"><p className="eyebrow">PURCHASE COMPLETE</p><h1>{error ?? "決済を確認しています"}</h1><p>{error ? "決済後、通常はすぐに専用閲覧ページを表示します。処理状況により数分かかる場合があります。" : "決済完了後、通常は直ちに専用閲覧ページで提供します。処理状況により数分かかる場合があります。"}</p><p>詳細レポートの閲覧期限は購入完了日から180日間です。</p><p className="legal-links"><a href={legalLinks.terms}>利用規約</a><span aria-hidden="true"> / </span><a href={legalLinks.privacy}>プライバシーポリシー</a><span aria-hidden="true"> / </span><a href={legalLinks.commercialTransactions}>特定商取引法に基づく表記</a><span aria-hidden="true"> / </span><a href={legalLinks.contact}>お問い合わせ</a></p></section></div></main>;
}
