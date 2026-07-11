# 診断システム v1.0 TypeScript実装ガイド

## 目的

仕様書で確定した測定設計を、質問文・判定ロジック・レポート文章が疎結合になる形で実装する。

## 配置

```text
src/
  types.ts
  constants.ts
  scoring.ts
  report.ts
  validate.ts
  report/
    anchors.ts
    evidence.ts
    generate.ts
    overlap.ts
    prohibited.ts
    quality.ts
    wording.ts
    templates/
      labels.ts
      presentation.ts
  data/
    question-bank.ts
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
6. `generateFreeReport`で無料レポートJSONを生成する。
7. `generatePaidReport`で有料レポートJSONを生成し、品質ゲートを通す。
8. UI層で保存・表示へ接続する（本リポジトリでは未実装）。

## レポート生成契約

入口は`ReportInput`です。

```ts
type ReportInput = {
  result: DiagnosisResult;
  route: DiagnosisRoute;
  answers: AnswerRecord[];
  questions: QuestionDefinition[];
  freeAnchorLimit?: 0 | 1 | 2;
};
```

レポート層は完成済み結果を文章へ合成し、タイプ、出し方、ズレ、防衛、使いこなしを再計算しません。同一入力は同一JSONを返し、生成時刻は呼び出し側が必要に応じて付与します。

無料版は12ラベルまたは上位2候補ラベルを生成し、アンカーは0〜2件です。12ラベルは4タイプの共通文へ出し方一文だけを足す方式ではなく、一言コピー、コア欲望、出し方、守るもの、印象、誤解、強み、つまずき、行動方向を個別に保持します。有料版はresolvedで13セクション、low-confidenceで8セクションを生成します。low-confidenceでは単独タイプを断定せず、候補の共通点・違い・比較回答・切り替わる条件を価値として扱います。

本文は次の5層を段落単位で合成します。

1. タイプ層
2. 出し方層
3. ズレ層
4. 防衛・使いこなし層
5. 個別アンカー層

無料版の一撃と有料版の個別段落は、実際の質問・選択肢を短く要約して本文へ差し込みます。質問文の長い転載や、`AnswerReference`へ保存するだけの扱いにはしません。最大ズレ段落には本音側・対人側の回答、方向、強さ、広がりを日本語で表示します。

各段落には次を必須とします。

- `evidenceLevel`: `direct` / `derived` / `inferred` / `possibility`
- `sourceQuestionIds`
- ブロック別`confidence`
- `wordingStrength`: `direct` / `moderate` / `soft`
- `scenarioScope`

confidenceがhighなら`direct`、mediumなら`moderate`、lowなら`soft`です。同一ブロックで異なるmajor信頼性issueが2種類以上重なる場合だけ、そのブロックを`soft`へ下げます。infoの`positionStreak`単独では弱めません。

テンプレート主要文は`renderLabelCopy`でhigh／medium／lowの文末まで変換します。`sourceScores.reliabilityDowngraded`は監査情報に留め、品質ゲートは`ReportMetadata.effectiveWording`と各段落の`evidence.block`を照合します。任意の`sourceScores`書き換えだけではwording検査を回避できません。

low-confidence候補比較では、完成文ではなく各ラベルの`coreFocus`と`protectedFocus`を使います。一撃の導入句は勝ち筋・つながり・読み解き・軸で切り替え、low-confidenceでは候補へ寄らない中立表現を使います。relationshipsとworkも12ラベル専用断片から生成し、未測定領域として`possibility`を維持します。

本文には`strong`、`not_needed`、`growth`などの内部enumや、生の小数スコアを表示しません。`presentation.ts`でズレ、確認状態、確信度、防衛、機会数制限、気づき・活用帯、段差を自然な日本語へ変換します。内部値はevidenceの`sourceScores`とmetadataで監査用に保持します。

有料版の`AnswerReference`は異なる質問IDを3件以上保持し、タイプまたは比較から1件以上、ズレ・防衛・使いこなしから1件以上を含めます。最大ズレペアがある場合はギャップ章の根拠へ接続し、確認回答が最終判定に使われた場合はconfirmationアンカーを作ります。

## 有料品質ゲート

`validatePaidReport`は最低限以下を検証する。

- 4種versionとroute別必須セクション
- 全段落のevidenceと`sourceQuestionIds`
- 異なる直接回答参照3件以上と参照ブロックの構成
- 最大ズレ場面の反映
- 防衛low、同率、`opportunityLimited`の過剰断定防止
- low-confidenceでの単独タイプ断定防止
- confidenceと`wordingStrength`の一致
- 禁止表現カテゴリ6種
- 無料版との文単位正規化重複率（上限`0.35`）
- 根拠付き行動提案
- 未測定領域の`possibility`限定
- 内部enum、snake_case、生小数の本文混入防止

満たさない場合、検査関数は理由配列を返します。`generatePaidReport`は`PaidReportQualityError`を送出し、品質不合格のレポートを成功扱いで返しません。

防衛の過剰断定は文章検索ではなく、各防衛段落の`claimKind`とレポート内の`defenseContext`を照合します。第一防衛、同率、今回確認された反応、場面限定反応を構造として分離します。

禁止表現検査は、本人の本心断定、形成原因、医療、決定論的未来、相手の感情・関係の将来、タイプ優劣をカテゴリ付きで検出します。無料／有料の重複検査は空白・句読点・改行・ラベルを正規化し、タイトルと注記を除外します。

## version

レポートmetadataには次を保存します。

- `questionBankVersion`
- `scoringVersion`
- `engineVersion`
- `reportTemplateVersion`

結果とrouteのversion不一致、`AnswerRecord.questionVersion`と質問定義の不一致、回答ID重複は生成開始前に拒否します。

## テスト

```bash
npm ci
npm run typecheck
npm test
npm run report:samples
```

レポートテストは12ラベル、同タイプ3出し方の本文差、low-confidence、アンカー0〜2件、回答本文参照、最大ズレ、防衛同率・low・機会数制限・構造claim、確認回答、4段階evidence、3段階wording、内部値混入、禁止表現、品質ゲート、重複率境界、A・B・C統合を検証します。分岐狙いの手動TypeResolution fixtureとは別に、共通12回答からbaseスコア、比較要否、初回・追加比較、`resolveType`、route、最終結果、無料・有料レポート、品質ゲートまで通す完全E2Eも実行します。

`report:samples`はテストとは別の目視確認用です。12ラベル無料・有料、low-confidence、防衛同率、`opportunityLimited`、確認あり、confidence lowを含むJSONを標準出力へ出します。固定スナップショットは作成しません。
