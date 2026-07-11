# UI仕上げ実装計画 v1.0

## 目的と固定条件

対象HTMLは`diagnosis_v2_ui_localstorage_resume.html`。現在のReact基盤と診断エンジンを接続したまま、HTMLで確定している画面構成、主要文言、配色、余白、カード構造、画面遷移をReactへ移植する。

- 診断ロジック、質問文、採点、ルーティング、レポート生成は変更しない。
- 質問は同一ブロック内で最大4問。内部総問数は表示しない。
- 実装済みの`src/ui/engine.ts`、`session.ts`、`adapter.ts`、`page-builder.ts`を唯一の接続層とする。
- 決済、認証、DB、購入権限の本接続は行わない。HTMLの状態表現はUI状態として再現する。

## 現在のReact基盤

- 実装済み: 最小トップ、質問ページ、比較・ルート接続、保存・再開、version不一致、実データ無料結果、簡易ロック表示。
- 未移植: HTMLの全デザイン、イントロ、遷移・確認・ローディング、結果状態の分岐、購入案内・購入状態・詳細レポート、モーダル、共有、結果フィードバック。

## 工程

| # | 対象画面 | 主な変更ファイル | HTMLから再利用する構造 | React化する状態管理 | 診断エンジンとの接続点 | 完了条件 | 動作確認 |
|---:|---|---|---|---|---|---|---|
| 1 | 共通レイアウト・トークン | `src/ui/styles.css`、`src/ui/components/AppShell.tsx`、`TopBar.tsx` | `shell`、`topbar`、色・余白・カード・ボタンのCSS変数 | 画面共通のナビゲーション、トースト、モーダル開閉 | なし | HTMLの配色・タイポグラフィ・PC/スマホ幅を共通部品化 | 320px、768px、1440pxで崩れなし。キーボードでヘッダー操作可能 |
| 2 | トップページ | `HomePage.tsx`、`HomeVisual.tsx` | `home`、hero、SNS風public/privateカード、value/feature/CTA、footer | public/private表示切替、保存済みバナー、開始/再開/再開破棄 | `loadSession`、`newSession`、`saveSession` | 添付HTMLの訴求、CTA、再開表示、下部シェアを再現 | 新規開始、保存済み再開、再開破棄、表示切替、アンカー移動 |
| 3 | 開始前案内 | `IntroPage.tsx` | `intro`、`info-grid`、`status-box` | intro→診断開始、戻る | `newSession`、共通12問IDの設定 | 所要時間・途中保存・非表示問数方針を維持 | 開始・戻る、モバイルのカード積み上げ |
| 4 | 質問画面 | `QuestionFlow.tsx`、`QuestionPage.tsx`、`LikertQuestionCard.tsx`、`ComparisonQuestionCard.tsx`、`ProgressBar.tsx` | `likertPage`、`abPage`、`additionalAB`、カード、sticky actions、未回答表示 | ページ、選択済み回答、回答開始時刻、未回答対象、比較フェーズ | `toAnswer`、`upsertAnswer`、`orderQuestionOptions`、`scoreBaseTypes`、`resolveType`、`aggregateComparison`、`buildDiagnosisRoute` | 最大4問、ブロック非混在、選択肢順再現、初回/追加比較をUIへ反映 | 通常、比較2対0、比較1対1→追加、低確信度、回答変更、未回答、再開 |
| 5 | 質問終了前確認・中断 | `ConfirmationPage.tsx`、`PauseModal.tsx`、`RestartModal.tsx` | `transitionPage`、`confirmPage`、pause/restart modal | 確認回答、直前画面、保存・中断、最初からやり直し | ルートの確認質問、`saveSession`、`buildDiagnosisResult` | HTMLの左右ラベル付き5段階確認と中断フローを再現 | 確認必須、戻る、中断後再開、再開時の選択復元 |
| 6 | 生成中・不整合 | `LoadingPage.tsx`、`VersionMismatchPage.tsx`、`ErrorState.tsx` | `loadingPage`、`versionMismatch`、status box | 生成段階、例外、version mismatch、破損保存データ | `finishDiagnosis`、`versionsMatch` | 実レポート生成の待機・失敗表示と再開拒否を明示 | 成功、生成例外、4種version不一致、JSON破損、回復導線 |
| 7 | 無料結果 | `FreeResultPage.tsx`、`report-view-model.ts` | `resultPage`、result hero、result stack、confidence、locked preview、feedback | 結果状態（通常/低確信度/僅差/ズレ弱め）、結果フィードバック、ロック対象 | `FreeReport`、`DiagnosisResult`、`resultLabel`。文面はレポート生成結果のみ | 無料レポートをデータ駆動で表示し、未測定領域を独自補完しない | 12ラベル、低確信度、confidence、長文折返し、フィードバック操作 |
| 8 | 鍵付き項目 | `LockedReportModal.tsx`、`LockedPreview.tsx` | `lockedReportModal`、ロック済みカード、スクロール誘導 | 選択トピック、モーダル、購入案内へのフォーカス | 無料結果のアンカー・セクションIDを表示対象へ渡すだけ | 鍵付き項目が購入前詳細を漏らさず案内する | 開閉、Escape、フォーカス復帰、購入カードへのスクロール |
| 9 | 有料レポート案内・購入前 | `PaidReportGuidePage.tsx`、`PurchaseCard.tsx`、`PurchaseStateNote.tsx` | `paidReportPage`、price card、sticky purchase、状態セレクト | ready/processing/failed/purchased/unavailable | 本接続なし。状態は明示的なUIモックとして分離 | 添付HTMLの価格・内容・失敗/処理中表示を再現し、権限をlocalStorageで確定しない | 全5状態、disabled、sticky CTA、画面遷移、モバイル下部固定 |
| 10 | 購入済み詳細レポート | `PaidReportPage.tsx`、`paid-report-view-model.ts` | `fullReportPage`、deep section、章内CTA | purchased/unavailable、章移動 | 将来は`generatePaidReport`。今回の移植では固定サンプルと実生成結果を混在させない | 購入済みUIを表示し、未生成時はエラー状態を表示 | 実生成あり、未生成、低確信度、長文、章アンカー |
| 11 | シェア導線 | `ShareButton.tsx` | top/CTA外側のshare、`shareSite` | Web Share対応可否、clipboard成功/失敗トースト | 結果URLの生成は将来接続。現時点は現在URLのみ | Web Share→clipboard→手動コピーの順に安全にフォールバック | 対応/非対応、キャンセル、コピー失敗、キーボード操作 |
| 12 | 保存・再開導線の完成 | `session.ts`、`ResumeBanner.tsx`、`VersionMismatchPage.tsx`、関連テスト | resume banner、再開不可画面 | sessionId、seed、answers、route、type/comparison resolution、ページ位置、savedAt、4 version | 現行`DiagnosisSession`。不足状態があればUI移植時に保存形式を拡張するが、エンジンの型を正とする | 中断後も出題順、回答、選択肢順、位置を再現 | 初回、回答途中、比較途中、確認途中、4種version不一致 |
| 13 | レスポンシブ・アクセシビリティ | 全ページ、`styles.css` | HTMLの既存media query、カード/モーダル/固定CTA | フォーカストラップ、aria-live、フォーカス復帰、reduced motion | なし | WCAGの基本操作性を満たし、既存デザイン意図を保持 | 320px〜1440px、Tab/Escape/Enter、スクリーンリーダー名、色コントラスト |
| 14 | 統合QA・不要物監査 | `tests/ui-*.test.ts`、必要時Playwright手順 | 全遷移と状態表 | 開発用状態切替はproductionで非表示 | エンジンE2EとUI状態の境界を検証 | 型チェック、lint導入時はlint、全テスト、build、実ブラウザ、差分確認 | 全主要画面、保存再開、version不一致、比較、低確信度、購入モック、共有 |

## 実装順と境界

工程1〜7を先に行い、実データを扱う診断体験をHTML構造へ寄せる。工程8〜11は購入・共有のUI表現のみを移植し、決済・認証・DB・権限の外部接続は追加しない。工程12〜14は横断要件として、各画面移植と同じ変更単位で検証する。

## 提案（未実装）

画面状態を`App.tsx`へ追加し続けず、ページコンポーネントと`useDiagnosisFlow`へ分離することを推奨する。理由は、添付HTMLの画面・モーダル・購入状態が多く、診断エンジン状態と表示専用状態を分けなければ保存・再開・エラー表示の責務が混ざるため。影響範囲は`src/ui/`内に限定し、診断エンジンの型・スコア・ルーティング・レポート生成には影響しない。
