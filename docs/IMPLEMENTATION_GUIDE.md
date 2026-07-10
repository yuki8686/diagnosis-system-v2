# 診断システム v1.0 TypeScript実装ガイド

## 目的

仕様書で確定した測定設計を、質問文・判定ロジック・レポート文章が疎結合になる形で実装する。

## 推奨配置

```text
src/lib/diagnosis-v1/
  types.ts
  constants.ts
  scoring.ts
  report.ts
  validate.ts
  data/
    question-bank.ts
    free-report-templates.ts
    paid-report-templates.ts
    compatibility-templates.ts
```

## 重要原則

1. 共通12問の得点と比較質問を同じスコアへ加算しない。
2. 質問回答、算出結果、推定文章を別オブジェクトで保存する。
3. 各レポート文に根拠レベル、質問ID、確信度を持たせる。
4. 低確信度時は単一タイプ用テンプレートを使わない。
5. ハード上限48問、実運用上限47問。UIには問数を表示しない。
6. 文章テンプレートに恋愛・仕事などの領域断定を混ぜない。
7. 比較質問のみ共通12問直後にインライン発動し、出し方・使いこなし・ズレ確認は基本ブロック後の確認フェーズで固定優先順位に従う。
8. 共通タイプ・比較・防衛の選択肢順はセッションseedで再現し、リッカート1〜5は固定順とする。
9. 比較は`initial`・`additional`・`completed`を明示し、初回1対1以外から追加2問へ進めない。
10. low-confidenceへ入ったrouteはセッション内で固定し、遷移理由・確認発動理由・非発動理由を保存する。
11. `questionBankVersion`・`scoringVersion`・`engineVersion`・`reportTemplateVersion`を状態と結果へ保存し、異なるquestionVersionの回答は計算前に拒否する。
12. 信頼性フラグは対象ブロックへ紐付け、同一ブロックでmajor信号が複数重なった場合だけ当該confidenceを下げる。

## 実装順

1. `question-bank.ts`の物理質問バンク163問を維持する（比較質問は全6組×4問。ユーザーへの表示は確定39〜47問／低確信度39〜45問）。
2. `validateQuestionBank`をCIで実行する。
3. `scoreBaseTypes`からブロックごとの単体テストを作る。
4. 既存3回答パターンA/B/Cをfixture化する。
5. 比較・ルーティング・確認後スコアを`buildDiagnosisResult`まで統合する。
6. 無料レポート生成を実装する。
7. 有料レポートの品質ゲートを実装する。
8. localStorage再開とログ保存を接続する。

## 有料品質ゲート

有料レポート生成前に最低限以下を検証する。

- `maxGapPair`がある
- 防衛プロファイルがある
- 自覚・運用スコアがある
- 直接回答参照を3か所以上使用する
- 行動提案が1つある
- 各文に`InsightEvidence`がある

満たさない場合は有料レポートを生成せず、テンプレート不備として内部エラーにする。
