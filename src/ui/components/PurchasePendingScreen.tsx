export function PurchasePendingScreen({ error }: { error?: string }) {
  return <main className="screen active result-page"><div className="shell result-wrap"><header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>INNER NOTE</div></header><section className="result-section" aria-live="polite"><p className="eyebrow">PURCHASE COMPLETE</p><h1>{error ?? "決済を確認しています"}</h1><p>{error ? "決済後、通常はすぐに専用閲覧ページを表示します。処理状況により数分かかる場合があります。" : "決済完了後、通常は直ちに専用閲覧ページで提供します。処理状況により数分かかる場合があります。"}</p></section></div></main>;
}
