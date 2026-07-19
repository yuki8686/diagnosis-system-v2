import { PUBLIC_SALES_CONFIG } from "../../public-sales-config";
import { LegalDocumentDate } from "./LegalDocumentDate";

export function PrivacyPage() {
  return <main className="screen active result-page"><div className="shell result-wrap">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>{PUBLIC_SALES_CONFIG.diagnosisName}</div><a className="linkbtn" href="/">診断ページへ戻る</a></header>
    <article className="result-section legal-document" aria-labelledby="privacy-title">
      <p className="eyebrow">PRIVACY</p><h1 id="privacy-title">プライバシーポリシー</h1>
      <p>{PUBLIC_SALES_CONFIG.operatorName}（以下「運営者」といいます）は、{PUBLIC_SALES_CONFIG.diagnosisName}で取り扱う利用者情報について、以下の方針に従い適切に取り扱います。</p>

      <h2>取得する情報</h2><ul><li>診断回答、診断結果および診断の進行情報</li><li>1〜5の評価と任意コメントによるフィードバック</li><li>決済状況、購入日時、商品、金額およびStripeの決済識別情報</li><li>Stripe決済時に入力され、決済確認や本人確認のため必要な範囲で参照するメールアドレス等</li><li>問い合わせ内容と対応履歴</li><li>ホスティングやセキュリティ機能により生成される、IPアドレス、ブラウザ、端末、閲覧日時等を含む場合があるアクセスログ</li><li>ローカルストレージおよびセッションストレージへ保存される診断の進行情報と購入済み結果への参照情報</li><li>利用者が本サービスまたは問い合わせ時に提供するその他の情報</li></ul>
      <h2>カード情報</h2><p>カード番号等の決済情報はStripeが直接処理します。運営者は完全なカード番号を保存しません。</p>
      <h2>利用目的</h2><ul><li>診断の実施および結果表示</li><li>有料商品の決済確認、生成、提供および閲覧管理</li><li>購入者専用URLの発行、本人確認および再発行</li><li>購入履歴の確認</li><li>問い合わせ対応</li><li>不正利用、規約違反およびセキュリティ上の問題の防止</li><li>サービスの維持、改善および不具合調査</li><li>個人を識別できない形での集計および分析</li><li>法令上必要な対応</li></ul>
      <h2>診断回答の利用</h2><p>診断回答は、診断の実施、結果表示、サービス改善および個人を識別できない形での分析に利用します。</p>
      <h2>外部サービス</h2><p>本サービスは、決済処理にStripe、データ保存にFirebaseおよびGoogle Cloud、WebサイトとAPIの提供にCloudflareを利用します。これらの事業者では、各社の規約およびプライバシーポリシーに基づいて情報が取り扱われます。サービス運営上必要となる場合は、その他の委託先を利用することがあります。</p>
      <h2>第三者提供</h2><p>法令に基づく場合、人の生命、身体または財産の保護に必要な場合、行政機関等への協力が必要な場合、利用目的達成のための業務委託、事業承継その他法令上認められる場合を除き、本人の同意なく個人情報を第三者へ提供しません。</p>
      <h2>業務委託</h2><p>利用目的の達成に必要な範囲で、情報の取扱いを外部事業者へ委託する場合があります。その場合、必要かつ適切な監督を行います。</p>
      <h2>保存期間</h2><p>有料レポートと閲覧用トークンの有効期限は購入完了日から{PUBLIC_SALES_CONFIG.reportAccessDays}日間です。有料レポート生成に使用した回答データは生成完了後30日以内に削除できる期限情報を保持し、フィードバックは最大2年間を上限として保存します。購入履歴、会計情報、問い合わせ記録等は、法令対応およびサービス運営に必要な期間保存します。</p>
      <h2>安全管理</h2><p>不正アクセス、紛失、漏えい、改ざん等を防止するため、アクセス制御、秘密情報の分離その他必要かつ適切な安全管理措置を講じます。</p>
      <h2>ローカルストレージ等</h2><p>診断の途中保存、再開、購入済み結果への遷移、利便性向上および不具合調査のため、ブラウザのローカルストレージまたはセッションストレージを利用します。Stripe等の外部サービスでは、各社の提供機能に必要なCookie等が使用される場合があります。</p>
      <h2>開示・訂正・削除等</h2><p>保有する個人情報の開示、訂正、利用停止または削除等の請求には、法令に従い本人確認を行ったうえで対応します。</p>
      <h2>未成年者</h2><p>未成年者が有料商品を購入する場合は、必要に応じて法定代理人の同意を得てください。</p>
      <h2>問い合わせ</h2><p><a href={`mailto:${PUBLIC_SALES_CONFIG.contactEmail}`}>{PUBLIC_SALES_CONFIG.contactEmail}</a></p>
      <LegalDocumentDate/>
    </article>
  </div></main>;
}
