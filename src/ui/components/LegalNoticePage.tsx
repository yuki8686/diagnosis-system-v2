import { PUBLIC_SALES_CONFIG } from "../../public-sales-config";
import { legalLinks } from "../legal-links";
import { formatYen, paidProductPresentation } from "../product-config";

export function LegalNoticePage() {
  const contactHref = `mailto:${PUBLIC_SALES_CONFIG.contactEmail}`;
  return <main className="screen active result-page"><div className="shell result-wrap">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>{PUBLIC_SALES_CONFIG.diagnosisName}</div><a className="linkbtn" href="/">診断ページへ戻る</a></header>
    <section className="result-section legal-document" aria-labelledby="legal-title">
      <p className="eyebrow">LEGAL NOTICE</p><h1 id="legal-title">特定商取引法に基づく表記</h1>
      <dl className="legal-list">
        <dt>サービス運営名</dt><dd>{PUBLIC_SALES_CONFIG.operatorName}</dd>
        <dt>販売事業者情報</dt><dd>販売事業者の正式な法人名、運営責任者名、所在地および電話番号については、請求があった場合に遅滞なく電子メールにて提供します。開示をご希望の場合は、件名を「販売事業者情報の開示請求」として、<a href={contactHref}>{PUBLIC_SALES_CONFIG.contactEmail}</a>までご連絡ください。開示請求は商品の購入前にも行うことができます。</dd>
        <dt>サービス名</dt><dd>{PUBLIC_SALES_CONFIG.diagnosisName}</dd>
        <dt>販売商品</dt><dd>{PUBLIC_SALES_CONFIG.paidProductName}</dd>
        <dt>販売価格</dt><dd><strong>{paidProductPresentation.launchPriceLabel}：{formatYen(paidProductPresentation.launchPriceYen)}（税込）</strong><br/>通常価格：{formatYen(paidProductPresentation.regularPriceYen)}（税込）<br/>{PUBLIC_SALES_CONFIG.launchOfferNotice}</dd>
        <dt>商品代金以外の料金</dt><dd>インターネット接続料金、通信料金その他、利用者側で発生する費用は利用者の負担となります。</dd>
        <dt>支払方法</dt><dd>Stripeの決済画面に表示される支払方法をご利用いただけます。</dd>
        <dt>支払時期</dt><dd>購入手続き時に決済されます。実際の引き落とし時期は、利用する支払方法または決済事業者の定めによります。</dd>
        <dt>提供時期</dt><dd>決済確認後、原則として即時に購入者専用の閲覧URLを発行します。通信状況、決済処理、Webhookの遅延、システム障害等により、発行まで時間を要する場合があります。</dd>
        <dt>提供方法</dt><dd>購入完了後に発行される専用URLから、デジタル形式の詳細レポートを閲覧できます。</dd>
        <dt>閲覧期限</dt><dd>購入完了日から{PUBLIC_SALES_CONFIG.reportAccessDays}日間です。期限後は閲覧およびURLの再発行はできません。</dd>
        <dt>別端末での閲覧</dt><dd>閲覧期限内であれば、専用URLを使用して別端末からも閲覧できます。</dd>
        <dt>URLの再発行</dt><dd>購入履歴を確認でき、購入完了日から{PUBLIC_SALES_CONFIG.reportAccessDays}日以内で、購入時のメールアドレス等により本人確認ができる場合に対応します。必要に応じて再発行前のURLを無効化することがあります。</dd>
        <dt>第三者共有の禁止</dt><dd>閲覧URLの第三者への共有、譲渡、転載、販売または公開を禁止します。</dd>
        <dt>キャンセルおよび返金</dt><dd>デジタルコンテンツという商品の性質上、購入者都合によるキャンセルおよび返金は受け付けません。ただし、重複決済、当運営者の責めに帰すべき事由により商品を提供できない場合、その他当運営者が返金を相当と判断した場合は例外として対応します。</dd>
        <dt>システム変更時の対応</dt><dd>システム変更等により既存の閲覧URLが利用できなくなる場合、閲覧期限内の購入者に代替の閲覧方法または新しい閲覧URLを提供します。</dd>
        <dt>動作環境</dt><dd>インターネットへ接続できる端末と、一般的なWebブラウザが必要です。</dd>
        <dt id="contact">問い合わせ</dt><dd><a href={contactHref}>{PUBLIC_SALES_CONFIG.contactEmail}</a></dd>
      </dl>
      <p className="legal-links"><a href={legalLinks.terms}>利用規約</a><span aria-hidden="true"> / </span><a href={legalLinks.privacy}>プライバシーポリシー</a></p>
    </section>
  </div></main>;
}
