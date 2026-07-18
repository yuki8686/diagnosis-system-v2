# Cloudflare Worker Test環境 設定資料

## 1. この資料の目的

この資料は、診断システムver.2のCloudflare Worker **Test環境**を人手で構成するための設定手順です。Production設定ではありません。

- 実値、メールアドレス、秘密鍵、Secret Key、Webhook署名Secretはこの資料へ記録しない。
- StripeはTest Modeだけを使う。
- 本番販売導線とProduction環境は変更しない。
- Test E2Eが完了するまで、VercelからCloudflareへ本番経路を切り替えない。

## 2. 現在の実装状態

- 移植コミット: `a97d266` (`Migrate paid report delivery to Cloudflare Worker`)
- Worker実装と `wrangler deploy --dry-run --env test` は完了している。
- Test Worker環境`diagnosis-system-v2-test`の分離設定はコミット・push済みである。
- Cloudflareへの実デプロイ、Cloudflare環境変数・Secret登録は未実施である。
- 実Stripe Test E2Eは未実施である。
- Vercel APIは残っており、既存の販売経路である可能性がある。
- CloudflareとVercelのWebhookを同時に有効化してはならない。両者は同じ`diagnosisResults`と`stripeEvents`、5分の処理リースを扱う。

## 3. 環境変数一覧

`worker/env.ts`に定義される`ASSETS`以外の**22件**を対象とし、販売可否判定は`worker/offer.ts`の`purchaseConfigurationIsComplete()`で行われる。型上はすべて任意だが、下表の「Checkout有効化」で必須となる値が不足すると、`/api/offer`は準備中、`/api/results`と`/api/checkout`はfail-closedで拒否する。

| 変数名 | Secret/Variable | Test用の取得元 | Productionとの差 | Worker内の用途 | 未設定時の挙動 | 設定時の注意 |
| --- | --- | --- | --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Variable | 既存Firebase/Google Cloud Project（公開前Test E2Eに限る） | 今回は一時利用。公開後は分離を再検討 | Firestore REST APIのProject指定 | 購入有効化不可、Firestore処理不可 | Testデータを公開前に全削除する前提。別Projectが原則として安全 |
| `FIREBASE_CLIENT_EMAIL` | Variable（運用方針でSecret可） | 上記Projectで使うサービスアカウント | 今回は一時利用。公開後は分離を再検討 | サービスアカウントJWTの`iss` | 購入有効化不可、Firestore処理不可 | 実値を資料・スクリーンショットへ残さない |
| `FIREBASE_PRIVATE_KEY` | Secret | 上記サービスアカウントのPrivate Key | Production鍵と分離 | JWT署名、Firestore REST API認証 | 購入有効化不可、Firestore処理不可 | JSON全体ではなく鍵の値だけを登録。`\\n`は実改行へ変換される |
| `REPORT_ACCESS_TOKEN_SECRET` | Secret | Test専用に安全な乱数で生成 | Production値と必ず分離 | access tokenのHMAC-SHA256、所有証明 | 32文字未満または未設定なら購入有効化不可。閲覧・購入状態確認も失敗 | 32文字以上。リポジトリ、ログ、画面共有へ残さない |
| `STRIPE_SECRET_KEY` | Secret | Stripe DashboardのTest Mode Secret Key | Live Mode Keyと分離 | Price検証、Checkout Session作成、line item取得 | 購入有効化不可。Webhookでline item取得不可 | Test Mode表示を確認して取得 |
| `STRIPE_WEBHOOK_SECRET` | Secret | Cloudflare Test Worker用Webhook endpointの署名Secret | Production endpointのSecretと分離 | `Stripe-Signature`のWeb Crypto検証 | 購入有効化不可、`/api/webhook`は503 | endpoint作成後に確定する。初回デプロイ時は未設定でよい |
| `STRIPE_LAUNCH_PRICE_ID` | Variable | Stripe Test Modeのlaunch用one-time Price | Live Price IDと分離 | launch時のPrice、金額・通貨照合 | launch時に未設定なら購入有効化不可 | Test ModeのJPY・商品名を確認 |
| `STRIPE_REGULAR_PRICE_ID` | Variable | Stripe Test Modeのregular用one-time Price | Live Price IDと分離 | regular時のPrice、金額・通貨照合 | regular時に未設定なら購入有効化不可 | launch Test中でも将来切替用に確認しておく |
| `STRIPE_SALE_PRICE_MODE` | Variable | 人間が`launch`または`regular`を決定 | Productionの販売モードと独立管理 | 有効Priceと表示価格の切替 | 未設定・`regular`以外は実装上launch扱い | 曖昧さを避け、Testでは明示的に設定 |
| `PUBLIC_APP_URL` | Variable | Test Workerが静的SPAを配信するHTTPS origin | Productionドメインを使わない | Stripe success/cancel URL | 購入有効化不可 | 末尾`/`なしのoriginを登録。コードは末尾に`/?`を付加する |
| `LEGAL_SELLER_NAME` | Variable | Testで確認する法務表示値 | Production確定値とは分離して管理 | 販売可否判定 | 未設定なら購入有効化不可 | 実内容は法務確認を要する |
| `LEGAL_RESPONSIBLE_PERSON` | Variable | Testで確認する法務表示値 | 同上 | 販売可否判定 | 同上 | 同上 |
| `LEGAL_ADDRESS` | Variable | Testで確認する法務表示値 | 同上 | 販売可否判定 | 同上 | 同上 |
| `LEGAL_PHONE` | Variable | Testで確認する法務表示値 | 同上 | 販売可否判定 | 同上 | 同上 |
| `LEGAL_CONTACT_EMAIL` | Variable（運用方針でSecret可） | 公開設定`PUBLIC_SALES_CONFIG.contactEmail`と一致する値 | Production公開値と照合 | 販売可否判定 | 不一致・未設定なら購入有効化不可 | コード上、公開設定と完全一致が必要 |
| `LEGAL_SUPPORT_HOURS` | Variable | Testで確認する法務表示値 | 同上 | 販売可否判定 | 未設定なら購入有効化不可 | 人間が内容を確認 |
| `LEGAL_EFFECTIVE_DATE` | Variable | 法務表示の有効日 | Productionの開始日と混同しない | 販売可否判定 | 不正形式・未設定なら購入有効化不可 | 有効な`YYYY-MM-DD` |
| `SERVICE_NAME` | Variable | 公開設定の診断名と同じ確定名称 | Productionの正式名称と照合 | 販売可否判定 | 不一致・未設定なら購入有効化不可 | `PUBLIC_SALES_CONFIG.diagnosisName`と一致 |
| `DIAGNOSIS_NAME` | Variable | 公開設定の診断名と同じ確定名称 | 同上 | 販売可否判定 | 不一致・未設定なら購入有効化不可 | `SERVICE_NAME`とは別に同じ値が必要 |
| `PAID_PRODUCT_NAME` | Variable | Stripe Test Product名と公開設定に一致する名称 | Live Productと混同しない | 販売可否、Stripe Priceの商品名照合 | 不一致・未設定なら購入有効化不可 | `PUBLIC_SALES_CONFIG.paidProductName`とStripe商品名の両方に一致 |
| `MAIN_TYPE_NAMES` | Variable | 最終表示名の確認済み一覧 | Production表示名と分離管理 | 販売可否判定 | 未設定なら購入有効化不可 | 現実装は空でないことを確認する |
| `SUBTYPE_NAMES` | Variable | 最終表示名の確認済み一覧 | Production表示名と分離管理 | 販売可否判定 | 未設定なら購入有効化不可 | 現実装は空でないことを確認する |

### 必須・任意の整理

- **Checkout有効化に必須**: 上表の法務7件、販売名称5件、インフラ7件、ならびに現在の`STRIPE_SALE_PRICE_MODE`で選ばれるPrice ID。
- **実行経路ごとの必須**: `GET /api/offer`自体は値なしでも動作する。`POST /api/webhook`は`STRIPE_WEBHOOK_SECRET`を必要とし、Firestore処理にはFirebase 3件と`STRIPE_SECRET_KEY`を必要とする。閲覧・購入状態確認にはFirebase 3件と`REPORT_ACCESS_TOKEN_SECRET`を必要とする。
- **条件付き必須**: `STRIPE_REGULAR_PRICE_ID`は`STRIPE_SALE_PRICE_MODE=regular`のとき必須。`STRIPE_LAUNCH_PRICE_ID`はそれ以外のとき必須。

## 4. Firebase設定と公開前Test E2Eの例外運用

### 原則と今回の適用範囲

- 原則として、Test専用Firebase Projectを使うことが最も安全である。
- **今回に限り**、現在Firestoreに本番データがなく、Test期間中に本番書込みを開始せず、公開前にTestデータを全削除することを前提に、既存Firebase ProjectをStripe Test E2Eへ一時利用する。
- この例外は公開前のCloudflare Test E2Eだけに限定する。公開後に同じ方式を継続しない。
- 公開後もTestを行う場合は、Test専用Projectまたは`testRunId`等の環境識別フィールドを改めて検討する。現実装には環境識別フィールドやTest用collection prefixはない。

### 接続と権限

- `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`は、今回一時利用する既存Projectとサービスアカウントの値を使う。
- Private KeyはサービスアカウントJSONの**鍵値だけ**をCloudflare Secretへ登録する。JSONファイル全体、メールアドレス、鍵の値をこの資料・Issue・ログへ記載しない。
- Workerは値中の文字列`\\n`を実改行に置換してPKCS#8鍵として使用する。Cloudflareの入力方法に合わせ、PEMの改行が失われないことを人間が確認する。
- Firestore REST APIでOAuth tokenを取得し、`(default)` databaseを使う。サービスアカウントにはtransaction、document read、document write、queryに必要な最小権限だけを与える。具体的なIAM role名・組織ポリシーの適合は、既存Google Cloud管理者が確認する。

### Test E2Eで確認・削除するコレクション

| コレクション | Test E2Eでの用途 | 削除確認 |
| --- | --- | --- |
| `diagnosisResults` | 回答snapshot、購入状態、Checkout情報、有料レポート、期限 | 必須 |
| `diagnosisSessionIndex` | 同一診断sessionの冪等性。`resultId`を保存 | 必須 |
| `stripeEvents` | Webhook冪等性、処理リース、Stripe Event IDごとの記録 | 必須 |
| `resultFeedback` | 旧Vercelのfeedback APIだけが書く | 念のため確認 |

- Cloudflare Workerには`/api/feedback`が未移植である。Cloudflare Test E2Eだけなら通常`resultFeedback`は作成されない。
- 旧Vercel APIを経由した場合は`resultFeedback/{resultId}`が作成される可能性があるため、削除確認対象に含める。

## 5. Stripe Test設定

- `STRIPE_SECRET_KEY`にはStripe Dashboardの**Test Mode** Secret Keyだけを登録する。
- `STRIPE_LAUNCH_PRICE_ID`と`STRIPE_REGULAR_PRICE_ID`は、いずれもTest Modeのone-time Priceを確認する。TestとLiveのIDは外見が似ていても混在させない。
- Workerが受け付けるイベントは`checkout.session.completed`だけである。処理前後で`payment_status=paid`、`mode=payment`、Session ID、metadataの`resultId`、保存済みPrice ID、金額、通貨、line item数を照合する。
- Priceについて、JPY、想定金額、one-time、Product名（`PAID_PRODUCT_NAME`と一致）を確認する。Checkout作成時にWorkerもStripe APIで再検証する。
- Cloudflare Test Workerを初回デプロイしてURLを確認した**後**、Test ModeでWebhook endpointを作成する。対象eventは`checkout.session.completed`だけに絞る。
- endpoint作成後に得た署名Secretを`STRIPE_WEBHOOK_SECRET`へ登録し、再デプロイまたはCloudflareのSecret反映方法を人間が確認する。
- Test中のVercel endpointの扱いは、Stripe DashboardでCloudflare Test endpointと同一のTest決済イベントを同時に受信しないよう運用する。既存Vercel endpointの変更・停止は、この資料作成時点では行わない。
- Test決済後はStripe DashboardからWebhook再送を実施し、同一eventでレポートが二重生成されないことを確認する。

## 6. `REPORT_ACCESS_TOKEN_SECRET`

- Test専用の新しい高エントロピー値を使う。Production値をTest環境へ複製しない。
- 実装はaccess tokenを平文保存せず、この値によるHMAC-SHA256 hashをFirestoreへ保存・照合する。
- この値を変更すると、変更前の値でhashされた既存`diagnosisResults`のaccess tokenは、新しいWorkerから所有証明できない。購入状態確認と有料レポート閲覧は失敗する。
- 今回は既存Firebase Projectを一時利用するため、Test期間中も値を不用意に変更しない。変更が必要なら、旧Test結果の閲覧互換性が失われることを許容してから行う。Test結果は公開前の削除対象である。
- 32文字以上の安全な乱数をSecretとして登録し、リポジトリ、ログ、スクリーンショット、チャットへ残さない。

## 7. `PUBLIC_APP_URL`

- `purchaseConfigurationIsComplete()`はHTTPSを必須とする。`localhost`または`127.0.0.1`だけはローカル開発時にHTTPを許容する。
- 値はCheckoutの`success_url`と`cancel_url`に使われ、`/?checkout=success&resultId=...`または`/?checkout=cancelled&resultId=...`が追加される。
- Cloudflare Worker URLとフロントエンドURLを混同しない。登録するのは、購入完了画面と`/report/:accessToken`を実際に表示するTest SPAのoriginである。
- 実装は末尾スラッシュを正規化しない。末尾`/`を含めず、HTTPS originだけを登録する。
- Preview URLを使う場合は、URLの安定性、HTTPS、Stripe Test webhook endpointとの対応を確認する。本番ドメインをTest Workerへ登録しない。

## 8. 販売可否判定用変数

`purchaseConfigurationIsComplete()`が確認する条件は次のとおりである。

法務ページURL専用の環境変数は、現在のWorkerコードには存在しない。`/terms`、`/privacy`、`/legal`は静的SPAのルートであり、販売可否判定はURLではなく下表の法務・名称値を確認する。

| 区分 | 変数・条件 | 判定内容 |
| --- | --- | --- |
| コード実行に必要 | `STRIPE_WEBHOOK_SECRET` | Webhook署名検証に必要。未設定ならWebhookは503 |
| Checkout有効化 | `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`PUBLIC_APP_URL`、Firebase 3件、`REPORT_ACCESS_TOKEN_SECRET`、有効Price ID | すべて非空。access token secretは32文字以上 |
| Price切替 | `STRIPE_SALE_PRICE_MODE` | `regular`ならregular Price、それ以外はlaunch Priceを必須にする |
| URL形式 | `PUBLIC_APP_URL` | HTTPS、またはローカルだけHTTP |
| 法務表示に必須 | `LEGAL_SELLER_NAME`、`LEGAL_RESPONSIBLE_PERSON`、`LEGAL_ADDRESS`、`LEGAL_PHONE`、`LEGAL_CONTACT_EMAIL`、`LEGAL_SUPPORT_HOURS`、`LEGAL_EFFECTIVE_DATE` | 全て非空。連絡先は公開設定と一致し、日付は有効な`YYYY-MM-DD` |
| サービス名称に必須 | `SERVICE_NAME`、`DIAGNOSIS_NAME`、`PAID_PRODUCT_NAME`、`MAIN_TYPE_NAMES`、`SUBTYPE_NAMES` | 全て非空。最初の3件は公開設定の名称と一致 |
| 人間確認 | `PAID_PRODUCT_NAME`とStripe Product名、法務値、Priceの金額・通貨・Mode | コードも一部照合するが、登録前に人間がTest Modeで確認 |

未設定・形式不正・名称不一致では、購入CTAは「準備中」となり、結果作成とCheckout作成は販売準備中として拒否される。

## 9. 推奨設定順序

1. 使用するCloudflareアカウントを確認し、Productionアカウント・Workerと混同しない。
2. Worker名とTest環境名を決める。Production用の既存名称を誤用しない。
3. 今回一時利用する既存Firebase Projectに本番データがないこと、Test期間中に本番書込みを開始しないこと、サービスアカウントの最小権限を確認する。原則としてはTest専用Projectが安全であり、公開後のTest運用では分離を再検討する。
4. Stripe DashboardがTest Modeであることを確認し、launch/regularのPrice、商品名、金額、通貨を確認する。
5. Secret以外のVariableを登録する。`STRIPE_SALE_PRICE_MODE`は明示的に設定し、`PUBLIC_APP_URL`は末尾`/`なしのTest HTTPS originを使う。
6. `FIREBASE_PRIVATE_KEY`、`REPORT_ACCESS_TOKEN_SECRET`、`STRIPE_SECRET_KEY`をSecretとして登録する。初回はWebhook Secret未設定でもよい。
7. `npx wrangler deploy --dry-run`を再実行する。
8. Test Workerへ初回デプロイし、Worker URLと静的SPAを確認する。
9. `PUBLIC_APP_URL`で指定したTest origin、`/terms`、`/privacy`、`/legal`、`/api/offer`を確認する。
10. Stripe Test ModeでCloudflare Test Worker向けWebhook endpointを作成し、`checkout.session.completed`だけを購読する。
11. endpointの署名Secretを`STRIPE_WEBHOOK_SECRET`へ登録する。Secret反映後、`/api/offer`が購入可能と表示される条件を再確認する。
12. 実Stripe Test E2Eを実施する。
13. Stripe DashboardからWebhook再送を行い、二重生成がないことを確認する。
14. Workerログに秘密情報がないことを確認する。
15. Firestoreの保存結果、status、`paidAt`、期限、event記録を確認する。
16. 公開前に、Test E2E台帳に記録した対象を削除し、4コレクションの削除確認を完了する。Testデータを残したまま本番書込みを開始しない。

Webhook Secretはendpoint作成後にしか得られないため、手順6〜8は購入がfail-closedのまま行う。endpoint作成後の手順10〜11でSecretを追加し、初めてWebhookを受け付けられる状態にする。

## 10. Test E2E台帳と公開前の削除確認

実値、access token、秘密鍵、HMAC Secretは台帳に記録しない。Test実施ごとに、次の識別情報と結果だけを記録する。

```text
Test実施日時：
resultId：
Stripe Checkout Session ID：
Stripe Event ID：
決済結果：
Webhook処理完了確認：
削除実施日：
削除確認者：
```

### 削除前の停止条件

- Test期間中に本番書込みを開始していない。
- Webhook処理が終了し、`generation-pending`または有効な処理リースが残っていない。
- Test E2Eで使った`resultId`、Checkout Session ID、Stripe Event IDを台帳で確認できる。
- CloudflareとVercelが同じTest決済イベントを並行処理していない。

### 削除チェックリスト

1. `diagnosisResults/{resultId}`を確認し、`stripeCheckoutSessionId`を控える。
2. `stripeEvents`から、台帳のStripe Event IDと`checkoutSessionId`が一致する文書を削除確認する。
3. `diagnosisSessionIndex`から、`resultId`が一致する文書を削除確認する。index文書IDはHMACだが、`resultId`で追跡できる。
4. `resultFeedback/{resultId}`の存在を確認し、存在する場合だけ削除確認する。Cloudflare Test E2Eだけなら通常は存在しない。
5. 最後に`diagnosisResults/{resultId}`を削除確認する。回答snapshot、有料レポート、30日・180日・730日の期限付きデータは同一文書に含まれる。
6. 台帳の削除実施日・削除確認者を記入し、Testデータが残っていないことを確認してから本番書込みを開始する。

現実装はFirestoreにTest/Productionを示す保存フィールドを持たない。上記の削除手順は、今回の「本番データがゼロで、公開前に削除する」例外運用に限って安全である。公開後に時刻やStripe IDだけでTestデータを抽出する運用は推奨しない。

## 11. 実Stripe Test E2Eチェックリスト

- [ ] 無料診断を完了できる
- [ ] Checkout Sessionを作成できる
- [ ] Stripe Testカードで決済できる
- [ ] `checkout.session.completed` Webhookを受信できる
- [ ] 決済前の結果が`awaiting-payment`である
- [ ] 生成中に`generation-pending`になる
- [ ] 生成成功後に`paid`になる
- [ ] 購入完了ポーリングが成功する
- [ ] 有料レポートを閲覧できる
- [ ] 別ブラウザ相当で専用URLを閲覧できる
- [ ] 不正tokenは汎用404になる
- [ ] 未払い状態は汎用404になる
- [ ] 生成中状態は汎用404になる
- [ ] 生成失敗状態は汎用404になる
- [ ] 期限切れは汎用404になる
- [ ] Webhook再送で二重生成されない
- [ ] `paidAt`を確認した
- [ ] `expiresAt`が`paidAt`から180日後である
- [ ] 回答データ期限が30日後である
- [ ] feedback期限が730日後である
- [ ] Price IDが保存済みの期待値と一致する
- [ ] 金額が期待値と一致する
- [ ] 通貨がJPYで一致する
- [ ] metadataの`resultId`が一致する
- [ ] Stripe Test Modeの値だけを使用している
- [ ] Workerログに秘密情報がない
- [ ] Firestoreに不要な秘密情報がない
- [ ] UIの購入完了導線が正常に動く

## 12. VercelからCloudflareへの将来切替手順（まだ実行しない）

1. Cloudflare Test E2E、Webhook再送、Firestore確認が完了するまでProductionを変更しない。
2. 切替日時を決め、必要なら新規決済を一時停止する案を決定する。
3. 切替直前に、Vercelの処理中Webhook、`stripeEvents`、`generation-pending`を確認する。
4. 旧Webhookが取得した5分の処理リースが失効し、処理済みイベントが安定したことを確認する。
5. Stripeの旧Vercel Webhook endpointを停止する。
6. Cloudflare側endpointを有効化する。両endpointを同時に有効化しない。
7. 少額の確認に相当するTest確認または承認済みの限定確認を行う。
8. エラー時の切り戻し条件（署名検証失敗、Firestore書込み失敗、二重生成疑い、購入完了画面不達）を確認する。
9. 切り戻す場合も、Cloudflare endpointを停止してリース状態を確認してからVercel側だけを有効化する。二重稼働は避ける。

## 13. 人間が入力・確認する欄

以下には状態だけを記録し、値そのものは記入しない。

```text
Cloudflareアカウント確認：確認済み
Cloudflare Test Worker名確認：`diagnosis-system-v2-test`
Firebase Project一時利用の前提確認：未確認
Test期間中の本番書込み停止確認：未確認
Firebase最小権限確認：未確認
Stripe Mode確認：未確認
Price金額・通貨・商品確認：未確認
Webhook endpoint確認：未確認
PUBLIC_APP_URL確認：未確認
Test E2E実施：未実施
Webhook再送確認：未実施
```

## 資料の根拠

- `worker/env.ts`: Workerが参照する環境変数一覧
- `worker/offer.ts`: 販売可否判定とfail-closed条件
- `worker/checkout.ts`、`worker/stripe.ts`: Checkout URL、Price、Stripe照合
- `worker/firestore.ts`: サービスアカウントJWT、Firestore REST API、token hash、保存期限
- `worker/webhook.ts`: Stripe署名、`checkout.session.completed`、レポート生成状態遷移
- `worker/paid-report.ts`、`worker/purchase-status.ts`: 閲覧と購入状態確認の公開契約
