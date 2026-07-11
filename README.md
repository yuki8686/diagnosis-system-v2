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
npm run report:samples
```

`npm run report:samples`は、12ラベルの無料・有料版と、低確信度、防衛同率、機会限定、確認あり、全ブロックlowの代表結果をJSONとして標準出力へ生成します。目視確認用であり、生成物は自動保存・Git管理しません。

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
