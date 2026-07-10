import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { aggregateComparison, resolveType } from "../src/scoring";
import type { AnswerRecord, TypeId } from "../src/types";

const answerFor = (questionId: string, selectedType: TypeId): AnswerRecord => {
  const question = Object.values(questionBank.comparisons).flat().find((item) => item.id === questionId);
  assert.ok(question);
  const option = question.options.find((item) => item.typeId === selectedType);
  assert.ok(option);
  return {
    questionId,
    questionVersion: 1,
    optionId: option.id,
    answeredAt: "2026-07-10T00:00:00.000Z",
    durationMs: 5000,
  };
};

assert.deepEqual(
  resolveType({ win: 7, connect: 3, analyze: 1, axis: 1 }, []),
  { kind: "resolved", primary: "win", secondary: "connect", source: "base" },
);

assert.equal(resolveType({ win: 4, connect: 3, analyze: 3, axis: 2 }, []).kind, "low-confidence", "flat profile is checked before closeness");
assert.equal(resolveType({ win: 5, connect: 4, analyze: 2, axis: 1 }, []).kind, "low-confidence", "close profile needs comparison");
assert.deepEqual(resolveType({ win: 6, connect: 3, analyze: 3, axis: 0 }, []), { kind: "resolved", primary: "win", source: "base" }, "tied second and third suppress secondary");

const pair: [TypeId, TypeId] = ["win", "connect"];
const questions = questionBank.comparisons["connect-win"];
const result20 = aggregateComparison(pair, questions, [answerFor("VS-WC-1", "win"), answerFor("VS-WC-2", "win")]);
assert.equal(result20.status, "resolved");
assert.equal(result20.status === "resolved" && result20.winner, "win");
assert.deepEqual(result20.counts, { win: 2, connect: 0, analyze: 0, axis: 0 });
assert.equal(result20.rawAnswers.length, 2);

const result11 = aggregateComparison(pair, questions, [answerFor("VS-WC-1", "win"), answerFor("VS-WC-2", "connect")]);
assert.equal(result11.status, "needs_more");
assert.deepEqual(result11.nextQuestionIds, ["VS-WC-3", "VS-WC-4"]);

for (const [name, types, expectedStatus, expectedWinner] of [
  ["4-0", ["win", "win", "win", "win"], "resolved", "win"],
  ["3-1", ["win", "connect", "win", "win"], "resolved", "win"],
  ["2-2", ["win", "connect", "win", "connect"], "low_confidence", undefined],
] as const) {
  const answers = questions.map((question, index) => answerFor(question.id, types[index]));
  const result = aggregateComparison(pair, questions, answers);
  assert.equal(result.status, expectedStatus, name);
  if (expectedWinner) assert.equal(result.status === "resolved" && result.winner, expectedWinner, name);
}

assert.throws(
  () => aggregateComparison(pair, questions, [answerFor("VS-WR-1", "analyze")]),
  /comparison pair/,
);

assert.throws(
  () => aggregateComparison(pair, questions, [answerFor("VS-WC-1", "win"), answerFor("VS-WC-1", "connect")]),
  /Duplicate comparison answer/,
  "the same comparison question cannot be answered more than once",
);

console.log("type and comparison boundary tests passed");
