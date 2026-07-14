import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { characterDisplayCopyForLabel, LABEL_TEMPLATES } from "../src/report/templates/labels";
import { scoreExpression } from "../src/scoring";
import { EXPRESSION_IDS, TYPE_IDS, type AnswerRecord, type ExpressionId, type QuestionDefinition } from "../src/types";

function answer(question: QuestionDefinition, value: number): AnswerRecord {
  return { questionId: question.id, questionVersion: question.version, optionId: String(value), numericValue: value, answeredAt: "2026-07-13T00:00:00.000Z", durationMs: 5_000 };
}

function expressionAnswers(questions: QuestionDefinition[], expression: ExpressionId): AnswerRecord[] {
  const normalized = expression === "outward" ? 5 : expression === "inward" ? 1 : 3;
  const base = questions.filter((question) => question.metric === "expression" && !question.isConfirmation && (question.polarity === "positive" || question.polarity === "negative"));
  const answers = base.map((question) => answer(question, question.polarity === "negative" ? 6 - normalized : normalized));
  if (expression === "adaptive") answers.push(...questions.filter((question) => question.metric === "expression" && question.isConfirmation && question.polarity === "switch").map((question) => answer(question, 5)));
  return answers;
}

const reached: string[] = [];
const expectedCharacterCopies = [
  { characterName: "戦車", headline: "立ち止まった流れを見ると、自分が先頭に立って動かしたくなる人。", coreDesire: "自分の力で状況を動かし、望む結果をつかみたい。", expressionDescription: "意志や目標をはっきりと外へ示し、周囲を巻き込みながら前へ進む。" },
  { characterName: "力", headline: "静かに見えても、心の奥では誰よりも負けたくない人。", coreDesire: "自分の力で状況を動かし、望む結果をつかみたい。", expressionDescription: "強い意志を内側に保ち、必要な瞬間まで力を蓄えながら粘り強く進む。" },
  { characterName: "魔術師", headline: "勝ち方をひとつに決めず、その場で最適な一手を生み出す人。", coreDesire: "自分の力で状況を動かし、望む結果をつかみたい。", expressionDescription: "相手や環境を読み、使う力や立ち位置を柔軟に切り替えて結果へつなげる。" },
  { characterName: "太陽", headline: "自分が心から楽しむことで、いつの間にか周りまで明るくしている人。", coreDesire: "人の心を動かし、関係の中で特別な存在になりたい。", expressionDescription: "感情や魅力を素直に表し、場全体へ熱や明るさを広げていく。" },
  { characterName: "恋人", headline: "広く好かれることより、大切な相手と深く結ばれたい人。", coreDesire: "人の心を動かし、関係の中で特別な存在になりたい。", expressionDescription: "少人数との信頼を丁寧に育て、互いに深く理解し合える関係を築く。" },
  { characterName: "節制", headline: "相手に合わせて温度を変えながら、人と人の間に心地よい流れを作る人。", coreDesire: "人の心を動かし、関係の中で特別な存在になりたい。", expressionDescription: "相手や場の空気を読み、距離感や役割を調整しながら自然につながりを作る。" },
  { characterName: "正義", headline: "曖昧な状況でも、何が事実かを切り分けて進むべき道を示す人。", coreDesire: "物事の仕組みを理解し、表面の奥にある答えを見つけたい。", expressionDescription: "集めた情報を整理し、判断基準や見通しとして周囲へ分かりやすく示す。" },
  { characterName: "隠者", headline: "誰も気づかない違和感を、答えが見えるまで一人で追い続ける人。", coreDesire: "物事の仕組みを理解し、表面の奥にある答えを見つけたい。", expressionDescription: "静かな環境で深く考え、自分が納得できるまで答えを内側で研ぎ澄ます。" },
  { characterName: "吊るされた男", headline: "世界を逆さから眺めることで、誰も気づかなかった答えを見つける人。", coreDesire: "物事の仕組みを理解し、表面の奥にある答えを見つけたい。", expressionDescription: "相手や状況に応じて視点を切り替え、複数の角度から意味を読み直す。" },
  { characterName: "女帝", headline: "自分の「好き」を育て、周りの世界まで豊かに変えていく人。", coreDesire: "自分の理想や美学を、納得できる形で現実に残したい。", expressionDescription: "感性や価値観を外へ表現し、人や環境へ広げながら新しい価値を育てる。" },
  { characterName: "星", headline: "まだ誰にも見えていない理想を、現実になるまで静かに守り続ける人。", coreDesire: "自分の理想や美学を、納得できる形で現実に残したい。", expressionDescription: "理想を内側で丁寧に育て、妥協せず完成度を高めてから外へ表す。" },
  { characterName: "運命の輪", headline: "大切なものは変えずに、届く形へ何度でも自分を更新できる人。", coreDesire: "自分の理想や美学を、納得できる形で現実に残したい。", expressionDescription: "自分の核を保ちながら、環境や時代に合わせて形や表現方法を変えていく。" },
];
const expectedCharacterNames = expectedCharacterCopies.map((copy) => copy.characterName);

assert.deepEqual(TYPE_IDS, ["win", "connect", "analyze", "axis"], "the four stored type IDs stay unchanged");
assert.deepEqual(EXPRESSION_IDS, ["outward", "inward", "adaptive"], "the three stored expression IDs stay unchanged");
for (const type of TYPE_IDS) {
  const questions = questionBank.byType[type].expression;
  const confirmationIds = questions.filter((question) => question.isConfirmation && question.polarity === "switch").map((question) => question.id) as [string, string];
  for (const expression of EXPRESSION_IDS) {
    const options = expression === "adaptive" ? { confirmationActivated: true, confirmationAnswered: true, confirmationQuestionIds: confirmationIds } : {};
    const result = scoreExpression(questions, expressionAnswers(questions, expression), false, options);
    assert.equal(result.pattern, expression, `${type}:${expression} is reachable through its real expression questions`);
    assert.ok(LABEL_TEMPLATES[`${type}:${expression}`], `${type}:${expression} has a report template`);
    reached.push(`${type}:${expression}`);
  }
}
assert.equal(reached.length, 12, "all four main types support all three expression patterns");
assert.equal(new Set(reached).size, 12, "the matrix has no duplicate combination keys");
assert.deepEqual(Object.values(LABEL_TEMPLATES).map(({ characterName, headline, coreDesire, expressionDescription }) => ({ characterName, headline, coreDesire, expressionDescription })), expectedCharacterCopies, "the 12 internal combinations map to the approved character copy without wording drift");
assert.equal(new Set(expectedCharacterNames).size, 12, "all Arcana display names are unique");
assert.equal(characterDisplayCopyForLabel("勝ち筋タイプ・打ち出す型")?.characterName, "戦車", "a legacy stored result label resolves to the current display name without changing internal IDs");
assert.equal(characterDisplayCopyForLabel("戦車")?.expression, "outward", "a current display name resolves to its unchanged expression ID");
assert.equal(new Set(Object.values(LABEL_TEMPLATES).map((template) => template.headline)).size, 12, "all 12 combinations have distinct headline copy");
for (const [key, template] of Object.entries(LABEL_TEMPLATES)) {
  assert.ok(template.characterName.trim(), `${key}: character name is present`);
  assert.ok(template.headline.trim(), `${key}: headline is present`);
  assert.ok(template.coreDesire.trim(), `${key}: core desire is present`);
  assert.ok(template.expressionDescription.trim(), `${key}: expression description is present`);
}
console.log("type-expression 12-combination reachability tests passed");
