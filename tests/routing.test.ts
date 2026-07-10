import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { buildDiagnosisRoute, orderQuestionOptions, type BuildDiagnosisRouteInput } from "../src/routing";
import type { ComparisonResolution, TypeResolution, TypeScores } from "../src/types";

const counts = (win: number, connect: number): TypeScores => ({ win, connect, analyze: 0, axis: 0 });
const comparisonContract = {
  initialQuestionIds: ["VS-WC-1", "VS-WC-2"] as [string, string],
  additionalQuestionIds: ["VS-WC-3", "VS-WC-4"] as [string, string],
};
const baseResolved: TypeResolution = { kind: "resolved", primary: "win", secondary: "connect", source: "base" };
const baseLow: TypeResolution = { kind: "low-confidence", candidates: ["win", "connect"] };
const route = (input: Omit<BuildDiagnosisRouteInput, "sessionId" | "transitionSequence">) => buildDiagnosisRoute({ ...input, sessionId: "legacy-route-tests", transitionSequence: 1 });
const comparison2: ComparisonResolution = {
  status: "resolved",
  winner: "win",
  pair: ["win", "connect"],
  counts: counts(2, 0),
  rawAnswers: [
    { questionId: "VS-WC-1", selectedType: "win" },
    { questionId: "VS-WC-2", selectedType: "win" },
  ],
  nextQuestionIds: [],
  phase: "completed",
  ...comparisonContract,
};
const comparison4Low: ComparisonResolution = {
  status: "low_confidence",
  pair: ["win", "connect"],
  counts: counts(2, 2),
  rawAnswers: [
    { questionId: "VS-WC-1", selectedType: "win" },
    { questionId: "VS-WC-2", selectedType: "connect" },
    { questionId: "VS-WC-3", selectedType: "win" },
    { questionId: "VS-WC-4", selectedType: "connect" },
  ],
  nextQuestionIds: [],
  phase: "completed",
  ...comparisonContract,
};
const comparison4Resolved: ComparisonResolution = { status: "resolved", phase: "completed", winner: "win", pair: ["win", "connect"], counts: counts(3, 1), rawAnswers: comparison4Low.rawAnswers, nextQuestionIds: [], ...comparisonContract };
const comparisonNeedsMore: ComparisonResolution = {
  status: "needs_more",
  pair: ["win", "connect"],
  counts: counts(1, 1),
  rawAnswers: [
    { questionId: "VS-WC-1", selectedType: "win" },
    { questionId: "VS-WC-2", selectedType: "connect" },
  ],
  nextQuestionIds: ["VS-WC-3", "VS-WC-4"],
  phase: "additional",
  ...comparisonContract,
};

const pendingComparison = route({
  resolution: baseLow,
  comparison: comparisonNeedsMore,
  confirmationNeeds: {},
  answeredQuestionIds: [...questionBank.commonType.map((question) => question.id), "VS-WC-1", "VS-WC-2"],
  sessionSeed: "route-seed",
});
assert.equal(pendingComparison.route, "pending-comparison");
assert.equal(pendingComparison.currentStep, "comparison");
assert.equal(pendingComparison.nextQuestionId, "VS-WC-3");
assert.equal(pendingComparison.questionIds.length, 16);
assert.deepEqual(pendingComparison.activatedConfirmations, []);

const resolved39 = route({ resolution: baseResolved, confirmationNeeds: {}, sessionSeed: "route-seed" });
assert.equal(resolved39.questionIds.length, 39);
assert.equal(resolved39.route, "resolved");
assert.equal(resolved39.currentStep, "common-type");
assert.equal(resolved39.nextQuestionId, "C01");
assert.equal(resolved39.remainingAdditionalBudget, 6);
assert.equal("userQuestionCount" in resolved39, false);

const resolved47 = route({
  resolution: { kind: "resolved", primary: "win", secondary: "connect", source: "comparison" },
  comparison: comparison2,
  confirmationNeeds: { expression: true, utilization: true, gap: true },
  sessionSeed: "route-seed",
});
assert.equal(resolved47.questionIds.length, 47);
assert.deepEqual(resolved47.activatedConfirmations, ["expression", "utilization", "gap"]);
assert.equal(resolved47.remainingAdditionalBudget, 0);

const low39 = route({ resolution: baseLow, confirmationNeeds: {}, sessionSeed: "route-seed" });
assert.equal(low39.questionIds.length, 39);
assert.equal(low39.remainingAdditionalBudget, 2);
assert.ok(low39.questionIds.includes("GE04"));
assert.equal(low39.questionIds.filter((id) => id.startsWith("GE")).length, 4);
for (const id of ["U-A1", "U-R1", "U-O1", "T-U-A1", "T-U-R1", "T-U-O1"]) assert.ok(low39.questionIds.includes(id), id);

const low43 = route({ resolution: baseLow, comparison: comparison4Low, confirmationNeeds: {}, sessionSeed: "route-seed" });
assert.equal(low43.questionIds.length, 43);
assert.equal(low43.remainingAdditionalBudget, 2);

const low45 = route({ resolution: baseLow, comparison: comparison4Low, confirmationNeeds: { gap: true }, sessionSeed: "route-seed" });
assert.equal(low45.questionIds.length, 45);
assert.deepEqual(low45.activatedConfirmations, ["gap"]);
assert.ok(low45.questionIds.includes("GZ6-H"));
assert.ok(low45.questionIds.includes("GZ6-P"));

const capped = route({
  resolution: { kind: "resolved", primary: "win", secondary: "connect", source: "comparison" },
  comparison: comparison4Resolved,
  confirmationNeeds: { expression: true, utilization: true, gap: true },
  sessionSeed: "route-seed",
});
assert.equal(capped.questionIds.length, 47);
assert.deepEqual(capped.activatedConfirmations, ["expression", "utilization"]);
assert.deepEqual(capped.skippedConfirmations, ["gap"]);
assert.ok(capped.questionIds.length <= 47);
assert.ok(capped.questionIds.length < 48);

const choiceQuestion = questionBank.commonType[0];
const ordered1 = orderQuestionOptions(choiceQuestion, "same-session").map((option) => option.id);
const ordered2 = orderQuestionOptions(choiceQuestion, "same-session").map((option) => option.id);
assert.deepEqual(ordered1, ordered2);
assert.deepEqual([...ordered1].sort(), choiceQuestion.options.map((option) => option.id).sort());
assert.notDeepEqual(ordered1, choiceQuestion.options.map((option) => option.id));
const likert = questionBank.genericExpression[0];
assert.deepEqual(orderQuestionOptions(likert, "same-session").map((option) => option.id), ["1", "2", "3", "4", "5"]);

const resumed = route({
  resolution: baseResolved,
  confirmationNeeds: {},
  answeredQuestionIds: ["C01", "C02"],
  sessionSeed: "same-session",
});
assert.equal(resumed.nextQuestionId, "C03");
assert.equal(resumed.sessionSeed, "same-session");

console.log("routing and deterministic option-order tests passed");
