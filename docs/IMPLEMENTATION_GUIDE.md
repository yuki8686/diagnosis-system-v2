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

## 実装順

1. `question-bank.ts`へ133問を移植する。
2. `validateQuestionBank`をCIで実行する。
3. `scoreBaseTypes`からブロックごとの単体テストを作る。
4. 既存3回答パターンA/B/Cをfixture化する。
5. 無料レポート生成を実装する。
6. 有料レポートの品質ゲートを実装する。
7. localStorage再開とログ保存を接続する。

## 有料品質ゲート

有料レポート生成前に最低限以下を検証する。

- `maxGapPair`がある
- 防衛プロファイルがある
- 自覚・運用スコアがある
- 直接回答参照を3か所以上使用する
- 行動提案が1つある
- 各文に`InsightEvidence`がある

満たさない場合は有料レポートを生成せず、テンプレート不備として内部エラーにする。
