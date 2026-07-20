# Cloudflare Worker Test環境 設定資料

## 1. この資料の目的

この資料は、診断システムver.2のCloudflare Worker **Test環境**の設定と確認済みのE2E結果を記録する資料です。Production設定ではありません。

- 実値、メールアドレス、秘密鍵、Secret Key、Webhook署名Secretはこの資料へ記録しない。
- StripeはTest Modeだけを使う。
- 本番販売導線とProduction環境は変更しない。
- Test E2Eは完了している。Production公開は、別途の外部設定と公開判断が完了するまで行わない。

## 2. 現在の実装状態

- 移植の基礎コミット: `a97d266` (`Migrate paid report delivery to Cloudflare Worker`)
- Firestore応答処理の修正と回帰テスト: `798801e` (`Fix Cloudflare Firestore response handling`)
- Cloudflareアカウントは確認済みで、Account ID末尾は`3810`である。
- Test Worker環境`diagnosis-system-v2-test`は分離済みで、Test公開URLが発行されている。
- Static Assets配信、SPAルーティング、`/api/*`のWorkerルーティングを確認済みである。
- Test E2E完了後、Production Firestoreへの接続を遮断するためFirebase 3 Secretを削除した。Test WorkerにはFirebase以外の9件のSecretが残るが、結果作成・Checkout・feedback・有料レポートはFirebase不足によりfail-closedとなる。
- Stripe Test Modeで、980円・JPY・一回払いのCheckoutを完了した。Webhook署名検証、`checkout.session.completed`の処理、Firestore保存、有料レポート生成、専用URL閲覧、再読み込み、改変・無効token拒否、購入完了日から180日の失効日時保存を確認済みである。
- Test E2Eで作成したFirestoreデータは削除済みである。
- Production WorkerはCloudflare標準URLでデプロイ済みである。ProductionにはFirebase、公開origin、法務開示、Production専用report access tokenが設定済みで、Stripe Live設定は未完了のため購入導線は準備中である。
- 旧Vercel APIのソースは互換性・履歴のため残るが、Productionでは使用しない予定である。

### Firestore応答処理の回帰対策

- Firestore REST APIの応答が64 KiBを超える場合、Checkout結果の読出しが失敗する事象を確認した。
- Checkoutでは必要なフィールドだけを取得するよう修正した。
- 有料レポート生成用の完全な結果読出しには、有限の2 MiB上限を設けた。
- Firestoreの整形JSON、配列、NDJSON応答を正規化し、回帰テストを追加した。

## 3. 環境変数一覧

`worker/env.ts`に定義される値のうち、現行の`on-request`方式で使う**12件**を対象とする。`public`方式へ変更する場合だけ、販売者情報4件が追加で必要になる。販売可否判定は`worker/offer.ts`の`purchaseConfigurationIsComplete()`で行われる。型上はすべて任意だが、下表の「Checkout有効化」で必須となる値が不足すると、`/api/offer`は準備中、`/api/results`と`/api/checkout`はfail-closedで拒否する。

| 変数名 | Testでの登録先 | Test用の取得元 | Productionとの差 | Worker内の用途 | 未設定時の挙動 | 設定時の注意 |
| --- | --- | --- | --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID` | 未登録（削除済み） | なし | Productionだけが既存Firebase Projectを使用 | Firestore REST APIのProject指定 | Test WorkerからFirestoreへ接続不可 | Production FirestoreへのTest接続遮断のため削除。再登録しない |
| `FIREBASE_CLIENT_EMAIL` | 未登録（削除済み） | なし | Productionだけがサービスアカウントを使用 | サービスアカウントJWTの`iss` | Test WorkerからFirestoreへ接続不可 | Production FirestoreへのTest接続遮断のため削除。再登録しない |
| `FIREBASE_PRIVATE_KEY` | 未登録（削除済み） | なし | ProductionだけがPrivate Keyを使用 | JWT署名、Firestore REST API認証 | Test WorkerからFirestoreへ接続不可 | Production FirestoreへのTest接続遮断のため削除。再登録しない |
| `REPORT_ACCESS_TOKEN_SECRET` | Secret | Test専用に安全な乱数で生成 | Production値と必ず分離 | access tokenのHMAC-SHA256、所有証明 | 32文字未満または未設定なら購入有効化不可。閲覧・購入状態確認も失敗 | 32文字以上。リポジトリ、ログ、画面共有へ残さない |
| `STRIPE_SECRET_KEY` | Secret | Stripe DashboardのTest Mode Secret Key | Live Mode Keyと分離 | Price検証、Checkout Session作成、line item取得 | 購入有効化不可。Webhookでline item取得不可 | Test Mode表示を確認して取得 |
| `STRIPE_WEBHOOK_SECRET` | Secret | Cloudflare Test Worker用Webhook endpointの署名Secret | Production endpointのSecretと分離 | `Stripe-Signature`のWeb Crypto検証 | 購入有効化不可、`/api/webhook`は503 | Test endpointの設定後に登録済み。Productionでは別のSecretを使う |
| `STRIPE_LAUNCH_PRICE_ID` | Secret | Stripe Test Modeのlaunch用one-time Price | Live Price IDと分離 | launch時のPrice、金額・通貨照合 | launch時に未設定なら購入有効化不可 | Test ModeのJPY・商品名を確認 |
| `STRIPE_REGULAR_PRICE_ID` | Secret | Stripe Test Modeのregular用one-time Price | Live Price IDと分離 | regular時のPrice、金額・通貨照合 | regular時に未設定なら購入有効化不可 | launch Test中でも将来切替用に確認しておく |
| `STRIPE_SALE_PRICE_MODE` | Secret | 人間が`launch`または`regular`を決定 | Productionの販売モードと独立管理 | 有効Priceと表示価格の切替 | 未設定・`regular`以外は実装上launch扱い | 曖昧さを避け、Testでは明示的に設定 |
| `PUBLIC_APP_URL` | Secret | Test Workerが静的SPAを配信するHTTPS origin | Productionドメインを使わない | Stripe success/cancel URL | 購入有効化不可 | 末尾`/`なしのoriginを登録。コードは末尾に`/?`を付加する |
| `LEGAL_DISCLOSURE_MODE` | Secret | `on-request` | Test/Productionとも公開法務ページの方針と一致 | 販売可否判定 | 未設定・未知値・公開ページと不一致なら購入有効化不可 | 現在の確定方針は`on-request`。`public`へ変える場合は法務ページとコードを同時に変更する |
| `LEGAL_CONTACT_EMAIL` | Secret | 公開設定`PUBLIC_SALES_CONFIG.contactEmail`と一致する値 | Production公開値と照合 | 販売可否判定 | 不一致・未設定なら購入有効化不可 | コード上、公開設定と完全一致が必要。人間が実際に請求を受け付けられることも確認する |

### 必須・任意の整理

- **Checkout有効化に必須**: `LEGAL_DISCLOSURE_MODE`、`LEGAL_CONTACT_EMAIL`、インフラ7件、ならびに現在の`STRIPE_SALE_PRICE_MODE`で選ばれるPrice ID。`STRIPE_SALE_PRICE_MODE`が未設定なら実装上launch扱いとなる。
- **実行経路ごとの必須**: `GET /api/offer`自体は値なしでも動作する。`POST /api/webhook`は`STRIPE_WEBHOOK_SECRET`を必要とし、Firestore処理にはFirebase 3件と`STRIPE_SECRET_KEY`を必要とする。閲覧・購入状態確認にはFirebase 3件と`REPORT_ACCESS_TOKEN_SECRET`を必要とする。
- **条件付き必須**: `STRIPE_REGULAR_PRICE_ID`は`STRIPE_SALE_PRICE_MODE=regular`のとき必須。`STRIPE_LAUNCH_PRICE_ID`はそれ以外のとき必須。
- **公開方式を採る将来の条件**: `LEGAL_DISCLOSURE_MODE=public`を公開ページと同時に採用するときだけ、`LEGAL_SELLER_NAME`、`LEGAL_RESPONSIBLE_PERSON`、`LEGAL_ADDRESS`、`LEGAL_PHONE`を全て非空で追加する。現行の`on-request`方針ではこれらを登録しない。
- **コードを唯一の出所とする名称**: サービス・診断・有料商品名は`src/public-sales-config.ts`、メインタイプ名・サブタイプ名・12キャラクター名は`src/types.ts`、`src/constants.ts`、`src/report/templates/labels.ts`で管理する。環境変数への二重登録はしない。
- **未確定の法務表示値**: `LEGAL_SUPPORT_HOURS`と`LEGAL_EFFECTIVE_DATE`は現行コードの環境変数ではない。確定出所がないため値を推測せず、将来表示が必要になった場合は法務ページ・コード・テストを同時に人間確認のうえ追加する。

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
| `resultFeedback` | Cloudflare Workerの`POST /api/feedback`が書く | 念のため確認 |

- Cloudflare Workerには`/api/feedback`が移植済みである。ただしTest WorkerはFirebase接続を遮断済みであるため、今後のTest操作では`resultFeedback`を作成できない。
- 既存のTest E2Eではfeedbackを送信していない。過去に旧Vercel APIを経由していた場合も含め、削除確認対象に残す。

## 5. Stripe Test設定と確認結果

- `STRIPE_SECRET_KEY`、`STRIPE_LAUNCH_PRICE_ID`、`STRIPE_REGULAR_PRICE_ID`、`STRIPE_SALE_PRICE_MODE`は、Test Mode専用の値として登録済みである。TestとLiveの値は混在させない。
- `PUBLIC_APP_URL`と`STRIPE_WEBHOOK_SECRET`もTest Worker用として登録済みである。値やTest公開URLはこの資料へ記録しない。
- Workerが受け付けるイベントは`checkout.session.completed`だけである。Test E2Eで、Webhook署名、`payment_status=paid`、`mode=payment`、Session ID、metadataの`resultId`、保存済みPrice ID、金額、通貨、line item数の照合を通過した。
- 980円・JPY・一回払いのTest Checkoutを確認済みである。Checkout作成時には、WorkerがPriceの通貨、金額、one-time、Product名（`PUBLIC_SALES_CONFIG.paidProductName`と一致）を再検証する。
- 将来のLive移行時は、同じStripeイベントを複数の有効なWebhook endpointで並行処理しない。

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
- 実装は末尾スラッシュを除去して正規化する。ただし設定値は曖昧さを避けるため、末尾`/`なしのHTTPS originを登録する。
- Preview URLを使う場合は、URLの安定性、HTTPS、Stripe Test webhook endpointとの対応を確認する。本番ドメインをTest Workerへ登録しない。

## 8. 販売可否判定用変数

`purchaseConfigurationIsComplete()`が確認する条件は次のとおりである。

法務ページURL専用の環境変数は、現在のWorkerコードには存在しない。`/terms`、`/privacy`、`/legal`は静的SPAのルートであり、販売可否判定は公開ページと一致する開示方式および連絡先を確認する。

| 区分 | 変数・条件 | 判定内容 |
| --- | --- | --- |
| コード実行に必要 | `STRIPE_WEBHOOK_SECRET` | Webhook署名検証に必要。未設定ならWebhookは503 |
| Checkout有効化 | `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`PUBLIC_APP_URL`、Firebase 3件、`REPORT_ACCESS_TOKEN_SECRET`、有効Price ID | すべて非空。access token secretは32文字以上 |
| Price切替 | `STRIPE_SALE_PRICE_MODE` | `regular`ならregular Price、それ以外はlaunch Priceを必須にする |
| URL形式 | `PUBLIC_APP_URL` | HTTPS、またはローカルだけHTTP |
| 法務開示方式 | `LEGAL_DISCLOSURE_MODE` | `public`または`on-request`のみ。公開ページの確定方式と一致しなければfail-closed。現在は`on-request` |
| 請求時提供方式に必須 | `LEGAL_CONTACT_EMAIL` | 非空かつ`PUBLIC_SALES_CONFIG.contactEmail`と一致。人間が実際に請求を受け付けられることを確認する |
| 公開方式に追加で必須 | `LEGAL_SELLER_NAME`、`LEGAL_RESPONSIBLE_PERSON`、`LEGAL_ADDRESS`、`LEGAL_PHONE` | 公開方式を採る場合だけ全て非空。現行の`on-request`では未登録 |
| 人間確認 | `PUBLIC_SALES_CONFIG.paidProductName`とStripe Product名、法務公開ページ、Priceの金額・通貨・Mode | コードも一部照合するが、登録前に人間がTest Modeで確認 |

未設定・形式不正・名称不一致では、購入CTAは「準備中」となり、結果作成とCheckout作成は販売準備中として拒否される。

## 9. Production公開前の残作業

Test環境の構築、E2E、Testデータ削除は完了している。Production公開は、以下を順に完了するまで行わない。

1. `/privacy`のWeb/API提供基盤の表記をCloudflare構成へ修正する（今回の更新で完了）。
2. Production FirebaseのFirestore Database、IAM最小権限、Security Rules、対象コレクションが空であることを人間確認する。
3. Stripe Liveの商品、Price、Webhook endpointを作成・照合する。
4. Stripe Live専用SecretをProductionへ登録する。Testの値は流用しない。
5. Live Checkoutを「支払う」直前まで確認する。実決済はしない。
6. 公開判定を行う。

今回の更新では、手順1だけを完了扱いにする。手順2以降は未完了である。

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

今回のTest E2Eでは、次を確認したうえで削除を完了している。

- Test期間中に本番書込みを開始していない。
- Webhook処理が終了し、`generation-pending`または有効な処理リースが残っていない。
- Test E2Eで使った`resultId`、Checkout Session ID、Stripe Event IDを台帳で確認できる。
- 同じStripe Testイベントを複数の有効なWebhook endpointで並行処理していない。

### 削除チェックリスト

1. `diagnosisResults/{resultId}`を確認し、`stripeCheckoutSessionId`を控える。
2. `stripeEvents`から、台帳のStripe Event IDと`checkoutSessionId`が一致する文書を削除確認する。
3. `diagnosisSessionIndex`から、`resultId`が一致する文書を削除確認する。index文書IDはHMACだが、`resultId`で追跡できる。
4. `resultFeedback/{resultId}`の存在を確認し、存在する場合だけ削除確認する。Cloudflare Test E2Eだけなら通常は存在しない。
5. 最後に`diagnosisResults/{resultId}`を削除確認する。回答snapshot、有料レポート、30日・180日・730日の期限付きデータは同一文書に含まれる。
6. 台帳の削除実施日・削除確認者を記入し、Testデータが残っていないことを確認してから本番書込みを開始する。

現実装はFirestoreにTest/Productionを示す保存フィールドを持たない。上記の削除手順は、今回の「本番データがゼロで、公開前に削除する」例外運用に限って安全である。公開後に時刻やStripe IDだけでTestデータを抽出する運用は推奨しない。

## 11. 実Stripe Test E2Eの確認済み結果

- [x] 無料診断結果を作成できた
- [x] Checkout Sessionを作成し、Stripe Test Modeで980円・JPY・一回払いの決済を完了した
- [x] `checkout.session.completed`を受信し、Webhook署名検証と決済情報の照合を通過した
- [x] Firestoreへ購入情報と有料レポート情報を保存した
- [x] 有料レポートを専用URLで表示し、再読み込みでも確認した
- [x] 改変・無効tokenを拒否した
- [x] `paidAt`から180日後の失効日時を保存した
- [x] Test E2Eで作成したFirestoreデータを削除した

未記載の観測項目を追加で確認する必要がある場合は、Production設定と混在させず、別のTest E2Eとして台帳を作成して実施する。

## 12. 人間が入力・確認する欄

以下には状態だけを記録し、値そのものは記入しない。

```text
Cloudflareアカウント確認：確認済み
Cloudflare Test Worker名確認：`diagnosis-system-v2-test`
Test公開URL、Static Assets、APIルーティング確認：確認済み
Test用Secret登録：確認済み
Stripe Test Mode、980円・JPY・一回払い確認：確認済み
Webhook endpointと署名検証確認：確認済み
PUBLIC_APP_URL確認：確認済み
Test E2E実施：完了
Test Firestoreデータ削除：完了
Production Firebase Secret登録：完了（IAM／Rules／空コレクションは人間確認待ち）
Production公開origin決定：完了（Cloudflare Worker標準URL）
Stripe Live設定：未確認
Cloudflare Production Secret登録：一部完了（Stripe Live 5件は未登録）
Production Workerデプロイ：完了（購入はfail-closed）
```

## 資料の根拠

- `worker/env.ts`: Workerが参照する環境変数一覧
- `worker/offer.ts`: 販売可否判定とfail-closed条件
- `worker/checkout.ts`、`worker/stripe.ts`: Checkout URL、Price、Stripe照合
- `worker/firestore.ts`: サービスアカウントJWT、Firestore REST API、token hash、保存期限
- `worker/webhook.ts`: Stripe署名、`checkout.session.completed`、レポート生成状態遷移
- `worker/paid-report.ts`、`worker/purchase-status.ts`: 閲覧と購入状態確認の公開契約

## 2026-07-20 Production確認補足

この章はTest環境の既存E2E実績を変更せず、Productionで別途確認した範囲を区別して記録する補足である。

- ProductionではLive Checkoutへの遷移まで確認済み。商品名は「本音キャラ診断 詳細レポート」、980円、JPY、一回払いであり、Test Mode表示はない。
- Live決済、Stripe `checkout.session.completed` Webhook受信、Firestoreへの`paid`保存、有料レポート生成、専用URL発行および閲覧は未実測である。
- Production Firestoreの残存データは合計5件を確認した。由来不明、paidデータまたは実顧客データの可能性を排除できないため、削除していない。
- `resultFeedback`件数は未確認であり、0件とは扱わない。
- 今後のProduction確認で作成するデータは、Production公開状況資料の確認用データ台帳へ記録する。Test環境の確認結果とProductionの実測結果を混同しない。
