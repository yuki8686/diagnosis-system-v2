import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { aggregateComparison, resolveType } from "../src/scoring";
import type { AnswerRecord, ComparisonInput, TypeId } from "../src/types";

const questions = questionBank.comparisons["connect-win"];
const answer = (questionId: string, selectedType: TypeId): AnswerRecord => {
  const question = questions.find((item) => item.id === questionId) ?? Object.values(questionBank.comparisons).flat().find((item) => item.id === questionId);
  assert.ok(question);
  const option = question.options.find((item) => item.typeId === selectedType);
  assert.ok(option);
  return { questionId, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
};

const input = (answers: AnswerRecord[], phase: ComparisonInput["phase"]): ComparisonInput => ({
  expectedPair: ["win", "connect"],
  initialQuestionIds: ["VS-WC-1", "VS-WC-2"],
  additionalQuestionIds: ["VS-WC-3", "VS-WC-4"],
  answers,
  phase,
});

assert.throws(() => aggregateComparison(questions, input([answer("VS-WC-3", "win"), answer("VS-WC-4", "win")], "initial")), /initial comparison/i);
assert.throws(() => aggregateComparison(questions, input([answer("VS-WC-1", "win"), answer("VS-WC-2", "win"), answer("VS-WC-3", "connect")], "additional")), /2-0|additional/i);
assert.throws(() => aggregateComparison(questions, input([answer("VS-WC-1", "win"), answer("VS-WC-2", "win")], "additional")), /1-1|additional/i);

const resolved = aggregateComparison(questions, input([answer("VS-WC-1", "win"), answer("VS-WC-2", "connect"), answer("VS-WC-3", "win"), answer("VS-WC-4", "win")], "additional"));
assert.equal(resolved.status, "resolved");
assert.throws(() => resolveType({ win: 5, connect: 4, analyze: 2, axis: 1 }, { ...resolved, pair: ["analyze", "axis"] }), /top two|pair/i);

const outsidePair = structuredClone(questions);
outsidePair[0].options[0].typeId = "analyze";
assert.throws(() => aggregateComparison(outsidePair, input([answer("VS-WC-1", "win")], "initial")), /expected pair|outside/i);

assert.throws(() => aggregateComparison(questions, input([answer("VS-WC-1", "win"), answer("VS-WC-1", "connect")], "initial")), /duplicate/i);
assert.throws(() => aggregateComparison(questions, input([
  answer("VS-WC-1", "win"), answer("VS-WC-2", "connect"), answer("VS-WC-3", "win"), answer("VS-WC-4", "connect"), answer("VS-WC-3", "win"),
], "additional")), /at most four|5|duplicate/i);

const restoredInitialWin = aggregateComparison(questions, input([answer("VS-WC-1", "win"), answer("VS-WC-2", "win")], "completed"));
assert.equal(restoredInitialWin.status, "resolved");
assert.equal(restoredInitialWin.status === "resolved" && restoredInitialWin.winner, "win");

console.log("strict comparison phase contract tests passed");
