import { PUBLIC_SALES_CONFIG } from "../../public-sales-config";
import { legalLinks } from "../legal-links";
import { LegalDocumentDate } from "./LegalDocumentDate";

export function TermsPage() {
  return <main className="screen active result-page"><div className="shell result-wrap">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>{PUBLIC_SALES_CONFIG.diagnosisName}</div><a className="linkbtn" href="/">診断ページへ戻る</a></header>
    <article className="result-section legal-document" aria-labelledby="terms-title">
      <p className="eyebrow">TERMS</p><h1 id="terms-title">利用規約</h1>
      <p>本規約は、{PUBLIC_SALES_CONFIG.operatorName}（以下「運営者」といいます）が提供する{PUBLIC_SALES_CONFIG.diagnosisName}の利用条件を定めるものです。</p>

      <h2>サービス内容</h2><p>本サービスは、利用者の回答をもとに診断結果を提供するWebサービスです。無料の「{PUBLIC_SALES_CONFIG.freeProductName}」と、有料の「{PUBLIC_SALES_CONFIG.paidProductName}」があります。</p>
      <h2>診断結果の位置づけ</h2><p>診断結果は自己理解を補助するための参考情報です。医学的、心理学的その他の専門的な診断、治療、鑑定または助言ではありません。診断結果を踏まえた判断および行動は、利用者自身の責任で行ってください。</p>
      <h2>購入条件</h2><p>有料商品の価格、支払方法、提供時期、閲覧期限および返金条件は、購入画面と<a href={legalLinks.commercialTransactions}>特定商取引法に基づく表記</a>に表示します。利用者はこれらと本規約、<a href={legalLinks.privacy}>プライバシーポリシー</a>を確認し、同意したうえで購入するものとします。</p>
      <h2>支払方法</h2><p>Stripeの決済画面に表示される支払方法を利用します。</p>
      <h2>商品提供</h2><p>決済確認後、原則として即時に購入者専用の閲覧URLを発行します。決済処理、通信状況またはシステム障害等により時間を要する場合があります。</p>
      <h2>閲覧期限</h2><p>有料レポートの閲覧期限は、購入完了日から{PUBLIC_SALES_CONFIG.reportAccessDays}日間です。期限後は閲覧およびURLの再発行はできません。</p>
      <h2>閲覧URL</h2><p>閲覧URLは購入者本人のみが利用できます。閲覧期限内であれば別端末からも利用できますが、第三者への共有、譲渡、転載、販売または公開を禁止します。</p>
      <h2>URLの再発行</h2><p>購入履歴を確認でき、閲覧期限内であり、購入時のメールアドレス等による本人確認ができる場合に対応します。必要に応じて、再発行前のURLを無効化することがあります。</p>
      <h2>キャンセルおよび返金</h2><p>デジタルコンテンツという商品の性質上、購入者都合によるキャンセルおよび返金は原則として受け付けません。ただし、重複決済、運営者の責めに帰すべき事由による提供不能、その他運営者が返金を相当と判断した場合は例外として対応します。</p>
      <h2>禁止事項</h2><ul><li>法令または公序良俗に違反する行為</li><li>サービス運営を妨害する行為</li><li>不正アクセスまたはその試み</li><li>閲覧URLを第三者へ共有する行為</li><li>コンテンツを無断で複製、転載、配布または販売する行為</li><li>第三者になりすます行為</li><li>その他、運営者が不適切と判断する行為</li></ul>
      <h2>知的財産権</h2><p>本サービスに含まれる文章、画像、デザイン、診断結果の構成および名称等に関する権利は、運営者または正当な権利者に帰属します。</p>
      <h2>サービスの変更・停止</h2><p>保守、障害対応またはサービス改善等のため、本サービスを変更または一時停止する場合があります。システム変更等により閲覧URLが利用できなくなる場合、購入完了日から{PUBLIC_SALES_CONFIG.reportAccessDays}日の閲覧期限内の購入者へ代替手段を提供します。</p>
      <h2>利用制限</h2><p>規約違反が確認された場合、閲覧URLの無効化その他必要な利用制限を行うことがあります。利用者の責任によるURL共有その他の規約違反については、返金の対象となりません。</p>
      <h2>免責</h2><p>運営者は、診断結果、効果または満足を保証しません。利用者の端末、通信環境またはブラウザ等に起因する不具合について責任を負わない場合があります。ただし、運営者の故意または重大な過失による場合、その他法令上免責できない場合を除きます。</p>
      <h2>規約の変更</h2><p>法令改正またはサービス内容の変更等に応じて、本規約を変更することがあります。重要な変更は本サービス上で周知します。</p>
      <h2>準拠法</h2><p>本規約は日本法に準拠します。</p>
      <h2>問い合わせ</h2><p><a href={`mailto:${PUBLIC_SALES_CONFIG.contactEmail}`}>{PUBLIC_SALES_CONFIG.contactEmail}</a></p>
      <LegalDocumentDate/>
    </article>
  </div></main>;
}
