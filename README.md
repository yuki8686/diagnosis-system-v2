# 診断システム ver.2 TypeScript基盤

MVP測定仕様書 v1.0 改訂5をコードへ移した、質問バンク・型・スコアリング・検証・テスト一式です。

## 完成済み

- 4タイプ共通質問12問
- 全6組み合わせの比較質問24問（初回2問＋1対1時の追加2問）
- 防衛反応7問
- 低確信度用の汎用出し方4問・汎用ズレ12問
- 4タイプ別の出し方・ズレ・使いこなし
- 質問ID、極性、タイプ対応、防衛カテゴリ、ズレペア対応
- 共通得点と比較得点を分離したタイプ判定
- ズレ3指標と強度判定
- 防衛反応の同率処理
- ブロック別確信度
- 12ラベルの無料・有料レポートJSON生成
- 低確信度専用の無料・有料レポートJSON生成
- 全段落の根拠レベル、質問ID、ブロック別confidence
- 有料品質ゲート、禁止表現検査、無料版との重複検査
- 質問バンク整合性チェック
- 回答パターンA・B・Cの自動テスト
- 初回・追加・完了を分離した比較フェーズ契約
- low-confidence固定、遷移履歴、確認理由、条件予算を保持するルーティング状態
- 確認回答を反映した最終DiagnosisResult統合
- ブロック別信頼性issueと4種version metadata

## 有料レポート販売MVPの実装状況

販売基盤と画面の技術実装は完了しています。Production公開には、下記のProduction外部設定とLive E2Eが必要です。

### 現行公開構成

- フロントエンド: Vite / React
- 静的配信: Cloudflare Workers Static Assets
- API: Cloudflare Workers
- 決済: Stripe Checkout / Webhook
- データ保存: Firebase Firestore
- GitHubリポジトリ: `yuki8686/diagnosis-system-v2`

Cloudflare WorkerはStatic Assetsと同一originで、次のAPIを提供します。

| メソッド | ルート | 用途 |
| --- | --- | --- |
| `GET` | `/api/offer` | 公開可能な販売状態と価格表示 |
| `GET` | `/api/legal` | 公開可能な法務設定の状態 |
| `POST` | `/api/results` | 診断結果と所有証明用tokenの作成 |
| `POST` | `/api/checkout` | Stripe Checkout Sessionの作成 |
| `POST` | `/api/webhook` | Stripe `checkout.session.completed`の処理 |
| `POST` | `/api/purchase-status` | 購入状態の照会 |
| `GET` | `/api/paid-report/:accessToken` | 購入済み有料レポートの閲覧 |
| `POST` | `/api/feedback` | 結果所有者からの評価・任意コメントの保存 |

`/api/feedback`はCloudflare Workerへ移植済みです。結果IDとHMAC所有証明、730日の受付期限、結果IDごとの重複防止をFirestore REST APIで確認し、access tokenを保存せずに`resultFeedback`へ書き込みます。旧Vercel APIコードは移植元・互換確認用として残しています。

### Test環境とProduction環境

- Test Worker: `diagnosis-system-v2-test`
- Production Worker: `diagnosis-system-v2`
- `wrangler.jsonc`では`env.test`と`env.production`を明示し、Production操作は常に`--env production`を付ける。
- TestとProductionでは、Secret、Stripe Price、Webhook Secretを必ず分離する。
- Test用の値をProductionへ流用しない。
- Production WorkerはCloudflare標準URLでデプロイ済みであり、独自ドメインは使用しない。
- Test WorkerからはFirebaseの3 Secretを削除済みで、同じFirestore Projectへ接続できない。Test Stripe Secret等は履歴確認用に残るが、Firebase不足により書込み・購入・閲覧処理はfail-closedとなる。
- ProductionではFirebase、公開origin、法務開示、Production専用report access token、Stripe Live設定を使用している。`/api/offer`から販売可能状態を取得でき、Live Checkoutへの遷移を確認済みである。Secretの値は記録しない。

Cloudflare Test E2Eでは、無料診断、980円・JPY・一回払いのStripe Test決済、Webhook、Firestore保存、有料レポート生成・閲覧、改変token拒否、180日失効日時、Testデータ削除を確認済みです。詳細は[Cloudflare Test環境資料](docs/cloudflare-test-environment-setup.md)を参照してください。

### Production実確認（2026-07-20）

- Productionトップページ、法務ページ、`/legal`の正常表示を確認済み。
- `npm.cmd run typecheck`と`npm.cmd test`が成功し、全テストが通過した。
- Live Checkoutへの遷移を確認済み。購入者向け商品名は「本音キャラ診断 詳細レポート」、価格は980円、通貨はJPY、支払い種別は一回払いであり、Stripe CheckoutにTest Mode表示はない。
- 実決済は実施していない。Live決済完了、`checkout.session.completed` Webhook受信、Firestoreへの`paid`保存、有料レポート生成、専用URL発行および購入者による閲覧は未実測である。
- Firestoreの残存データは合計5件を確認したが、由来不明、paidデータまたは実顧客データの可能性を排除できないため削除していない。`resultFeedback`件数は未確認であり、0件とは扱わない。

### 完了済み

- Stripe CheckoutとStripe署名Webhook
- Firestoreへの診断結果、購入状態、有料レポートの保存
- Webhook確認後にのみ実行するサーバー側有料レポート生成
- 暗号学的乱数のaccess tokenと、HMAC-SHA256 hashによる所有証明
- 推測困難な専用閲覧URLと購入確認画面
- 購入日基準の有料レポート180日、回答データ30日、フィードバック最大2年の期限保存と期限切れ閲覧拒否
- 法務表示の骨組みと、未設定時に本番Checkoutを拒否する設定検証
- 980円のサービス開始記念価格と1,980円の通常価格を分離したPrice切替
- Webhookのevent単位・result単位の冪等化、期限付き処理リース、再送時の再取得
- Checkoutのtransactionと期限付き作成リースによる並列作成防止
- 有料レポート生成失敗時の`generation-failed`状態
- Workerのbodyサイズ制限とJSON検証
- 4メインタイプ×3つの出し方の全12組み合わせに対する到達・テンプレート・無料／有料生成テスト
- typecheck、test、build、production bundleの秘密情報検査

内部構造は、4メインタイプ（`win`、`connect`、`analyze`、`axis`）と3つの出し方（`outward`、`inward`、`adaptive`）を別軸として維持します。ユーザー向け診断名は「本音キャラ診断」、12通りの結果表示名はアルカナ名で確定しています。内部IDと内部向け軸ラベルは保存互換性のため変更しません。

### 公開継続中の残存リスクと初回Live決済時の確認

Productionの最終判定は**条件付きで公開継続可能**です。Live Checkoutへの遷移までを確認済みとし、次の範囲はLive環境で未実測の残存リスクとして扱います。

- 初回Live決済時は即時監視を行い、`checkout.session.completed` Webhookの受信を確認する。
- Firestoreへの`paid`保存、有料レポート生成、専用URL発行および購入者による閲覧を確認する。
- 問題が発生した場合に購入者へ個別対応できる手段を用意する。
- Firestoreは作成時刻だけで削除対象を判断しない。確認用データとして断定できない、paid、実顧客または由来不明のデータは削除しない。

### リリース後対応可能

- `expiresAt`等を基準に対象を特定して削除する自動削除ジョブ
- access tokenをURL fragmentから交換する方式の検討
- Webhook処理のキュー化
- 有料レスポンスに対するクライアント側schema検証の厳密化
- `npm audit` moderate 6件の依存更新追跡（現在は未使用のCloud Storage依存経路で、破壊的downgradeやmajor overrideは行わない）

## 質問数について

物理質問バンク総数は **163問** です。

旧資料の「133問」は、条件付き確認質問と低確信度専用質問の一部を除外した集計が混在していました。旧TypeScript移植時点では151問でしたが、各タイプペアへ1対1時のみ使う追加比較2問（全12問）を独立IDで追加したため、現在の物理バンクは163問です。

これはユーザーの表示問数ではありません。

- 通常表示: 39〜47問
- 低確信度表示: 39〜45問
- ハード上限: 48問
- ユーザー案内: 「所要時間 約10分前後」

## コマンド

```bash
npm ci
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run --env test
npm run report:samples
```

`npm run report:samples`は、12ラベルの無料・有料版と、低確信度、防衛同率、機会限定、確認あり、全ブロックlowの代表結果をJSONとして標準出力へ生成します。目視確認用であり、生成物は自動保存・Git管理しません。

Productionへの実デプロイは、このREADMEの通常手順には含めません。Production外部設定、Live E2E、明示的な承認が完了した場合だけ実行してください。

## レポート生成

完成済みの`DiagnosisResult`と`DiagnosisRoute`を入力にし、生回答をレポート層で再スコアリングせず、決定的なJSONを生成します。

```ts
import { generateFreeReport, generatePaidReport } from "./src/index";

const input = { result, route, answers, questions };
const freeReport = generateFreeReport(input);
const paidReport = generatePaidReport(input, freeReport);
```

- 無料版: 4タイプ×3出し方の12個の固有テンプレートから、一言コピー、コア欲望、守るもの、印象、本人回答を使った一撃、価値の高い通知を合成します。個別アンカーは最大2件です。
- resolved有料版: 13セクションで、タイプ、出し方、ズレ、防衛・使いこなし、個別アンカーの5層を合成します。最大ズレ、防衛、今回確認された反応、使いこなし、領域別の可能性、行動提案は別々に扱います。
- low-confidence有料版: 8セクションで上位2タイプを併記し、単独タイプへ確定せず、切り替わる条件を観察対象にします。
- 有料版は異なる回答参照3件以上を本文へ実際に差し込み、タイプまたは比較回答、最大ズレペア、防衛・使いこなし・確認回答を追跡可能にします。
- 品質ゲート失敗時は`PaidReportQualityError`を送出し、成功した有料レポートとして返しません。

根拠レベルは`direct`、`derived`、`inferred`、`possibility`の4段階です。文章強度はブロック別confidenceにより`direct`、`moderate`、`soft`へ変換します。仕事・関係など未測定領域は`possibility`に限定します。

主要コピーはcore、出し方、守るもの、印象、誤解、強み、つまずき、relationships、workごとにhigh／medium／lowの自然な文末へ変換します。low-confidence比較では完成文を引用せず、`coreFocus`と`protectedFocus`の短い意味句を使用します。

内部enum、生のconfidence名、確認状態、英語のズレ分類、生の小数スコアは本文へ出さず、日本語表示へ変換します。防衛段落は`primary_defense`、`observed_reaction`、`defense_tie`、`scenario_limited`の構造claimを持ち、品質ゲートが`DefenseResult`との一致を確認します。

レポートには`questionBankVersion`、`scoringVersion`、`engineVersion`、`reportTemplateVersion`を保存します。回答と質問定義のversion不一致、回答重複、結果とrouteの不一致は生成前に拒否します。

`npm test`では以下を確認します。

- 163問のID重複なし
- 各ブロックの件数
- 共通質問の4タイプ対応
- 比較質問の2タイプ対応
- 防衛カテゴリ割り当て
- ズレのH/Pペア完全性
- パターンA: 勝ち筋・打ち出す・演出
- パターンB: 内に燃やす・抑圧
- パターンC: 低確信度・使い分け・反転
- 比較フェーズ不正入力、route固定、再開、seed、回答/version検証
- 出し方・ズレ・使いこなし確認後の最終結果統合
- 12ラベルと低確信度の無料・有料JSON
- 無料アンカー0〜2件、有料回答参照3件以上
- evidenceLevelとconfidence別wordingStrength
- 防衛同率・防衛low・機会数制限・確認回答のレポート反映
- 禁止表現、有料必須構造、行動提案、無料／有料重複率0.35境界
- 回答パターンA・B・Cからのレポート統合
- 実エンジンの回答→ルーティング→最終結果→無料／有料レポート→品質ゲートE2E
- 共通回答→baseスコア→比較要否→初回・追加比較→TypeResolutionまで実導出する完全E2E
