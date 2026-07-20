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

ProductionではFirebase接続、公開origin、法務開示、Production専用report access tokenおよびStripe Live設定を使用している。Secretの名前・値はこの文書に記録しない。

## 2026-07-20 Production確認結果

- Productionトップページ、法務ページ、`/legal`は正常表示。
- `npm.cmd run typecheck`は成功。
- `npm.cmd test`は成功し、全テストが通過。
- `GET /api/offer`から販売可能状態を取得できる。
- Live Checkoutへの遷移を確認。商品名は「本音キャラ診断 詳細レポート」、980円、JPY、一回払いであり、Test Mode表示はない。
- 実決済は未実施。

Live決済完了、Stripe `checkout.session.completed` Webhook受信、Firestoreへの`paid`保存、有料レポート生成、専用URL発行および購入者による専用URLからの閲覧は、Live環境で未実測の残存リスクである。不具合としては扱わない。

## Firestore整理結果（2026-07-20）

| 項目 | 結果 |
| --- | --- |
| 確認された残存データ | 合計5件 |
| 削除件数 | 0件 |
| 削除判断 | 由来不明、paidデータまたは実顧客データの可能性を排除できないため削除しない |
| `resultFeedback`件数 | 未確認。0件とは扱わない |
| 削除後件数 | 削除未実施のため変化なし。コレクション別の未確認値は補完しない |

現実装には確認用データを明確に識別するTest／Production識別フィールドやテストフラグがない。作成時刻だけを根拠にFirestoreデータを削除する運用は禁止する。

## 今後のProduction確認用データ台帳

Production確認でデータを作成する場合は、次を台帳に記録する。Checkout Session IDまたはStripe Event IDが発生しない確認では、`未発生`と記録する。

| 記録項目 |
| --- |
| 実施日時 |
| 実施者 |
| 確認目的 |
| 環境 |
| `resultId` |
| `diagnosisSessionIndex`のドキュメントIDまたはsession ID |
| Checkout Session ID |
| Stripe Event ID |
| paid状態 |
| feedbackの有無 |
| 削除対象か |
| 削除実施日時 |
| 削除確認者 |
| 備考 |

Secret、access token、所有証明token、秘密鍵は台帳に記録しない。

## Firestore削除ルール

- 作成時刻だけで削除対象と判断しない。
- `resultId`とsession indexの対応を確認する。
- paidデータは原則削除しない。
- 実顧客データの可能性があるもの、由来不明データは削除しない。
- ワイルドカードやコレクション一括削除を行わない。
- 削除対象IDを明示した個別削除のみ行う。
- 確認用データと断定できない場合は、削除せず残す。

## 最終判定

**条件付きで公開継続可能**

条件:

- 初回Live決済を即時監視する。
- Webhook受信、Firestoreへの`paid`保存、有料レポート生成を確認する。
- 専用URL発行と購入者による閲覧を確認する。
- 障害時の購入者への個別対応手段を準備する。
