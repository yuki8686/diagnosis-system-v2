import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { nextQuestionSetAfterCommon, questionsForIds } from "../src/ui/engine";
import { newSession } from "../src/ui/session";
import type { AnswerRecord, TypeId } from "../src/types";

type CommonPattern = {
  name: string;
  selectedTypes: TypeId[];
  optionIds: string[];
  scores: { win: number; connect: number; analyze: number; axis: number };
};

const patterns: Record<"clear" | "closeTwo" | "threeWay", CommonPattern> = {
  clear: {
    name: "clear win",
    selectedTypes: ["win", "win", "win", "win", "win", "win", "win", "connect", "connect", "connect", "analyze", "axis"],
    optionIds: ["A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "C", "D"],
    scores: { win: 7, connect: 3, analyze: 1, axis: 1 },
  },
  closeTwo: {
    name: "win/connect close pair",
    selectedTypes: ["win", "win", "win", "win", "win", "connect", "connect", "connect", "connect", "analyze", "analyze", "axis"],
    optionIds: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "C", "C", "D"],
    scores: { win: 5, connect: 4, analyze: 2, axis: 1 },
  },
  threeWay: {
    name: "win/connect/analyze three-way cluster",
    selectedTypes: ["win", "win", "win", "win", "connect", "connect", "connect", "connect", "analyze", "analyze", "analyze", "axis"],
    optionIds: ["A", "A", "A", "A", "B", "B", "B", "B", "C", "C", "C", "D"],
    scores: { win: 4, connect: 4, analyze: 3, axis: 1 },
  },
};

function answersFor(pattern: CommonPattern): AnswerRecord[] {
  assert.equal(pattern.selectedTypes.length, questionBank.commonType.length);
  const answers = questionBank.commonType.map((question, index) => {
    const option = question.options.find((candidate) => candidate.typeId === pattern.selectedTypes[index]);
    assert.ok(option, `${pattern.name}: ${question.id} has an option for ${pattern.selectedTypes[index]}`);
    return { questionId: question.id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-12T00:00:00.000Z", durationMs: 1000 };
  });
  assert.deepEqual(answers.map((answer) => answer.optionId), pattern.optionIds, `${pattern.name}: documented common-question option IDs are used`);
  return answers;
}

function transitionFor(pattern: CommonPattern) {
  const session = { ...newSession(), answers: answersFor(pattern), currentQuestionIds: questionBank.commonType.map((question) => question.id) };
  return nextQuestionSetAfterCommon(session);
}

function rankedTypes(scores: { win: number; connect: number; analyze: number; axis: number }): TypeId[] {
  const stableOrder: TypeId[] = ["win", "connect", "analyze", "axis"];
  return [...stableOrder].sort((left, right) => scores[right] - scores[left] || stableOrder.indexOf(left) - stableOrder.indexOf(right));
}

const clear = transitionFor(patterns.clear);
assert.deepEqual(clear.scores, patterns.clear.scores, "clear pattern base scores");
assert.deepEqual(rankedTypes(clear.scores).slice(0, 2), ["win", "connect"], "clear pattern top two types");
assert.equal(clear.scores.win - clear.scores.connect, 4, "clear pattern first-to-second margin");
assert.equal(clear.scores.win - clear.scores.analyze, 6, "clear pattern first-to-third margin");
assert.equal(clear.resolution.kind, "resolved", "clear pattern resolves directly");
assert.deepEqual(clear.resolution, { kind: "resolved", primary: "win", secondary: "connect", source: "base" });
assert.ok(clear.route, "clear pattern creates its type route");
assert.equal(clear.currentQuestionIds.some((id) => id.startsWith("VS-")), false, "clear pattern never enters AB comparison");
assert.equal(questionsForIds(clear.currentQuestionIds).some((question) => question.block === "type-comparison"), false, "clear pattern's UI question set is type-route only");

const closeTwo = transitionFor(patterns.closeTwo);
assert.deepEqual(closeTwo.scores, patterns.closeTwo.scores, "close pair base scores");
assert.deepEqual(rankedTypes(closeTwo.scores).slice(0, 2), ["win", "connect"], "close pair top two types");
assert.equal(closeTwo.scores.win - closeTwo.scores.connect, 1, "close pair first-to-second margin");
assert.equal(closeTwo.scores.win - closeTwo.scores.analyze, 3, "close pair first-to-third margin");
assert.equal(closeTwo.resolution.kind, "low-confidence", "close pair remains low-confidence before comparison");
assert.deepEqual(closeTwo.resolution.kind === "low-confidence" ? closeTwo.resolution.candidates : [], ["win", "connect"], "close pair candidates and ordering");
assert.equal(closeTwo.route, undefined, "close pair delays route construction until AB comparison");
assert.deepEqual(closeTwo.currentQuestionIds, ["VS-WC-1", "VS-WC-2"], "close pair enters the ordered initial AB questions");
assert.deepEqual(questionsForIds(closeTwo.currentQuestionIds).map((question) => question.block), ["type-comparison", "type-comparison"], "the UI receives comparison-block definitions");

const threeWay = transitionFor(patterns.threeWay);
assert.deepEqual(threeWay.scores, patterns.threeWay.scores, "three-way cluster base scores");
assert.deepEqual(rankedTypes(threeWay.scores).slice(0, 3), ["win", "connect", "analyze"], "three-way cluster leading types");
assert.equal(threeWay.scores.win - threeWay.scores.connect, 0, "three-way cluster first-to-second margin");
assert.equal(threeWay.scores.win - threeWay.scores.analyze, 1, "three-way cluster first-to-third margin");
assert.equal(threeWay.resolution.kind, "low-confidence", "three-way cluster remains low-confidence");
assert.deepEqual(threeWay.resolution.kind === "low-confidence" ? threeWay.resolution.candidates : [], ["win", "connect", "analyze"], "three-way cluster candidates and ordering");
assert.ok(threeWay.route, "three-way cluster creates its low-confidence route");
assert.equal(threeWay.route?.route, "low-confidence", "three-way cluster uses the low-confidence route");
assert.equal(threeWay.currentQuestionIds.some((id) => id.startsWith("VS-")), false, "three-way cluster does not enter a two-candidate AB comparison");
assert.equal(questionsForIds(threeWay.currentQuestionIds).some((question) => question.block === "type-comparison"), false, "three-way UI question set excludes comparison questions");

console.log("UI common-to-comparison transition tests passed");
