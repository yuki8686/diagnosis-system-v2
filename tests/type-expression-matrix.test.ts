import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { LABEL_TEMPLATES } from "../src/report/templates/labels";
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
assert.equal(new Set(Object.values(LABEL_TEMPLATES).map((template) => template.headline)).size, 12, "all 12 combinations have distinct headline copy");
console.log("type-expression 12-combination reachability tests passed");
