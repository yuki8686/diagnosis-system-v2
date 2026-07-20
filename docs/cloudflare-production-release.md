# Cloudflare Production公開状況

## 現在の公開構成

- Worker名: `diagnosis-system-v2`
- Wrangler環境: `production`（すべてのProduction操作で`--env production`を必須とする）
- 公開URL: `https://diagnosis-system-v2.honnekyara-678.workers.dev`
- 独自ドメイン: 未使用
- Static Assets: `./dist`、`ASSETS` binding、SPA fallback、`/api/*`のWorker優先を設定済み

## 実装済みのAPI

- `GET /api/offer`
- `GET /api/legal`
- `POST /api/results`
- `POST /api/checkout`
- `POST /api/webhook`
- `POST /api/purchase-status`
- `GET /api/paid-report/:accessToken`
- `POST /api/feedback`

feedbackは結果ID・HMAC所有証明・730日の受付期限を確認し、`resultFeedback/{resultId}`へ評価と任意コメントだけを保存する。access tokenと秘密値は保存しない。結果IDごとのcreate preconditionにより重複送信は409となる。

## Test／Productionの分離

- Test Worker: `diagnosis-system-v2-test`
- Production Worker: `diagnosis-system-v2`
- Test WorkerのFirebase 3 Secretは削除済みで、Production Firebaseへの接続を遮断している。
- Test Stripe Secret、Webhook Secret、Price ID、report access tokenはProductionへ流用しない。
- Productionのreport access tokenは専用に新規生成した値を使用する。

## Production Secretの状態

登録済み（値は記録しない）:

- Firebase接続3件
- `PUBLIC_APP_URL`
- `REPORT_ACCESS_TOKEN_SECRET`
- `LEGAL_DISCLOSURE_MODE`
- `LEGAL_CONTACT_EMAIL`

未登録のため販売を停止している項目:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_LAUNCH_PRICE_ID`
- `STRIPE_REGULAR_PRICE_ID`
- `STRIPE_SALE_PRICE_MODE`

この状態では`/api/offer`は準備中、`/api/results`と`/api/checkout`はfail-closedで拒否する。

## Stripe Liveの残作業

Stripe Liveの対象アカウントに本人ログイン後、次を確認・作成する。

1. 「本音キャラ診断 詳細レポート（開始記念価格）」、980円、JPY、一回払いの商品とPrice
2. 「本音キャラ診断 詳細レポート（通常価格）」、1,980円、JPY、一回払いの商品とPrice
3. `checkout.session.completed`のみを購読する`/api/webhook`向けWebhook endpoint
4. 上記Live専用の5 SecretをProductionへ登録し、販売モードを`launch`へ設定

Stripe内部の商品名は価格別に分ける。Workerは正式な購入者向け商品名に加え、この2つの内部商品名を許容しつつ、Price ID、金額、JPY、one-timeをサーバー側で照合する。実決済は行わず、Checkoutは「支払う」直前まで確認する。

## 公開前の人間確認

- FirebaseのFirestore Native Mode、対象4コレクションの空状態、Security Rulesの直接アクセス拒否、サービスアカウントの最小権限
- Stripe Liveの対象アカウント、価格、通貨、商品、Webhook endpoint、旧Vercel endpointとの二重配送なし
- Productionでfree resultとfeedbackを作成した場合のデータ削除台帳。公開開始時に0件方針を維持するなら、smoke testの結果とsession indexを関連づけて削除する
- Live決済、Webhook受信、paid保存、paid report生成・専用URLは未実測であり、Test環境のE2Eを根拠にした残存リスクである
