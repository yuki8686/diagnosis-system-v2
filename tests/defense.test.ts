import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { scoreDefense } from "../src/scoring";
import type { AnswerRecord, DefenseCategory } from "../src/types";

const answersFor = (categories: DefenseCategory[]): AnswerRecord[] => questionBank.defense.map((question, index) => {
  const option = question.options.find((item) => item.defenseCategory === categories[index]);
  assert.ok(option, `${question.id} has no ${categories[index]} option`);
  return {
    questionId: question.id,
    questionVersion: 1,
    optionId: option.id,
    answeredAt: "2026-07-10T00:00:00.000Z",
    durationMs: 5000,
  };
});

const expectedOpportunities = {
  counterattack: 2,
  prove: 5,
  distance: 5,
  "self-efface": 5,
  analyze: 5,
  "self-blame": 3,
  numb: 2,
  freeze: 1,
};

const high = scoreDefense(questionBank.defense, answersFor(["distance", "prove", "prove", "prove", "distance", "analyze", "analyze"]));
assert.equal(high.primary, "prove");
assert.equal(high.confidence, "high");
assert.equal(high.secondary, undefined);
assert.deepEqual(high.secondaryTied, ["distance", "analyze"]);

const medium = scoreDefense(questionBank.defense, answersFor(["counterattack", "prove", "prove", "self-blame", "numb", "distance", "analyze"]));
assert.equal(medium.primary, "prove");
assert.equal(medium.confidence, "medium");
assert.deepEqual(medium.primaryTied, []);

const primaryTie = scoreDefense(questionBank.defense, answersFor(["counterattack", "prove", "prove", "analyze", "numb", "distance", "analyze"]));
assert.equal(primaryTie.primary, undefined);
assert.deepEqual(primaryTie.primaryTied, ["prove", "analyze"]);
assert.equal(primaryTie.confidence, "low");

const low = scoreDefense(questionBank.defense, answersFor(["counterattack", "numb", "freeze", "self-blame", "prove", "distance", "analyze"]));
assert.equal(low.primary, undefined);
assert.equal(low.confidence, "low");
assert.equal(low.primaryTied.length, 7);

assert.deepEqual(high.opportunities, expectedOpportunities);
assert.equal(high.selectionRates.prove, 3 / 5);
assert.deepEqual(high.opportunityLimited, ["counterattack", "self-blame", "numb", "freeze"]);
assert.equal(high.observedReactions.length, 7);
assert.deepEqual(high.observedReactions[0], { questionId: "D1", category: "distance" });

const rateOrderedTie = scoreDefense(questionBank.defense, answersFor(["counterattack", "numb", "freeze", "self-blame", "prove", "distance", "analyze"]));
assert.equal(rateOrderedTie.primaryTied[0], "freeze", "selection rate only orders tied categories");
assert.equal(rateOrderedTie.primary, undefined, "selection rate must not promote a tied category");

console.log("defense tie and opportunity tests passed");
