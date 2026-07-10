import { strict as assert } from "node:assert";
import { ENGINE_VERSION, QUESTION_BANK_VERSION, REPORT_TEMPLATE_VERSION, SCORING_VERSION } from "../src/constants";
import { questionBank } from "../src/data/question-bank";
import { buildDiagnosisRoute, orderQuestionOptions } from "../src/routing";
import { aggregateComparison, scoreBaseTypes } from "../src/scoring";
import type { AnswerRecord, QuestionDefinition, TypeId, TypeResolution } from "../src/types";

const wc = questionBank.comparisons["connect-win"];
const comparisonAnswer = (id: string, typeId: TypeId): AnswerRecord => {
  const question = wc.find((item) => item.id === id)!;
  const option = question.options.find((item) => item.typeId === typeId)!;
  return { questionId: id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
};
const comparison = (answers: AnswerRecord[], phase: "initial" | "additional") => aggregateComparison(wc, {
  expectedPair: ["win", "connect"], initialQuestionIds: ["VS-WC-1", "VS-WC-2"], additionalQuestionIds: ["VS-WC-3", "VS-WC-4"], answers, phase,
});
const lowResolution: TypeResolution = { kind: "low-confidence", candidates: ["win", "connect"] };
const resolved: TypeResolution = { kind: "resolved", primary: "win", secondary: "connect", source: "base" };

const low = buildDiagnosisRoute({ sessionId: "session-1", sessionSeed: "seed-1", resolution: lowResolution, confirmationNeeds: {}, transitionSequence: 1 });
assert.equal(low.route, "low-confidence");
assert.equal(low.routeLocked, true);
assert.equal(low.routeLockedAt, 1);
assert.deepEqual(low.typeResolution, lowResolution);
assert.equal(low.sessionId, "session-1");
assert.equal(low.questionBankVersion, QUESTION_BANK_VERSION);
assert.equal(low.scoringVersion, SCORING_VERSION);
assert.equal(low.engineVersion, ENGINE_VERSION);
assert.equal(low.reportTemplateVersion, REPORT_TEMPLATE_VERSION);
assert.equal(low.basePlannedCount, 39);
assert.equal(low.consumedConditionalCount, 0);
assert.equal(low.remainingConditionalBudget, 2);
assert.equal(low.hardLimit, 48);
assert.equal(low.transitionHistory.length, 1);
assert.deepEqual(low.transitionHistory[0].triggeringQuestionIds, []);

const locked = buildDiagnosisRoute({ sessionId: "session-1", sessionSeed: "seed-1", resolution: resolved, confirmationNeeds: {}, previousState: low, transitionSequence: 2 });
assert.equal(locked.route, "low-confidence");
assert.deepEqual(locked.typeResolution, lowResolution);
assert.deepEqual(locked.transitionHistory, low.transitionHistory);
assert.throws(() => buildDiagnosisRoute({ sessionId: "session-1", sessionSeed: "seed-1", resolution: resolved, confirmationNeeds: {}, previousState: { ...low, scoringVersion: "0.9.0" }, transitionSequence: 2 }), /read-only|version/i);

const pendingComparison = comparison([comparisonAnswer("VS-WC-1", "win"), comparisonAnswer("VS-WC-2", "connect")], "initial");
const pending = buildDiagnosisRoute({ sessionId: "session-2", sessionSeed: "seed-2", resolution: lowResolution, comparison: pendingComparison, confirmationNeeds: {}, transitionSequence: 1, answeredQuestionIds: [...questionBank.commonType.map((q) => q.id), "VS-WC-1", "VS-WC-2"] });
assert.equal(pending.route, "pending-comparison");
assert.equal(pending.comparisonPhase, "additional");
assert.deepEqual(pending.expectedComparisonPair, ["win", "connect"]);
assert.equal(pending.remainingConditionalBudget, 4);
assert.equal(pending.nextQuestionId, "VS-WC-3");

const initialResolved = comparison([comparisonAnswer("VS-WC-1", "win"), comparisonAnswer("VS-WC-2", "win")], "initial");
const activated = buildDiagnosisRoute({ sessionId: "session-3", sessionSeed: "seed-3", resolution: { ...resolved, source: "comparison" }, comparison: initialResolved, confirmationNeeds: { expression: true, utilization: true, gap: true }, transitionSequence: 1 });
assert.equal(activated.confirmationActivationReasons.expression, "expression_mid_band");
assert.equal(activated.confirmationActivationReasons.utilization, "utilization_contradiction");
assert.equal(activated.confirmationActivationReasons.gap, "gap_direction_unclear");
assert.equal(new Set(activated.questionIds).size, activated.questionIds.length);

const repeated = buildDiagnosisRoute({ sessionId: "session-3", sessionSeed: "seed-3", resolution: { ...resolved, source: "comparison" }, comparison: initialResolved, confirmationNeeds: { expression: true }, previousState: activated, transitionSequence: 2 });
assert.equal(repeated.activatedConfirmations.filter((kind) => kind === "expression").length, 1);
assert.equal(repeated.confirmationSkipReasons.expression, "already_activated");
assert.equal(new Set(repeated.questionIds).size, repeated.questionIds.length);

const fourAnswerComparison = comparison([
  comparisonAnswer("VS-WC-1", "win"), comparisonAnswer("VS-WC-2", "connect"), comparisonAnswer("VS-WC-3", "win"), comparisonAnswer("VS-WC-4", "win"),
], "additional");
const capped = buildDiagnosisRoute({ sessionId: "session-4", sessionSeed: "seed-4", resolution: { ...resolved, source: "comparison" }, comparison: fourAnswerComparison, confirmationNeeds: { expression: true, utilization: true, gap: true }, transitionSequence: 1 });
assert.equal(capped.confirmationSkipReasons.gap, "budget_exceeded");
assert.equal(capped.questionIds.length, 47);

const completedAfterResume = buildDiagnosisRoute({ sessionId: "session-2", sessionSeed: "seed-2", resolution: { ...resolved, source: "comparison" }, comparison: fourAnswerComparison, confirmationNeeds: {}, previousState: pending, transitionSequence: 2, transitionReason: "comparison_completed", transitionTriggeringQuestionIds: ["VS-WC-3", "VS-WC-4"] });
assert.equal(completedAfterResume.route, "resolved");
assert.equal(completedAfterResume.transitionHistory.length, 2);
assert.deepEqual(completedAfterResume.transitionHistory[1], { from: "pending-comparison", to: "resolved", reason: "comparison_completed", sequence: 2, triggeringQuestionIds: ["VS-WC-3", "VS-WC-4"] });

const resumed = buildDiagnosisRoute({ sessionId: "session-5", sessionSeed: "same", resolution: resolved, confirmationNeeds: {}, transitionSequence: 1, answeredQuestionIds: ["C01", "C02"], askedQuestionIds: ["C01", "C02"] });
const resumedAgain = buildDiagnosisRoute({ sessionId: "session-5", sessionSeed: "same", resolution: resolved, confirmationNeeds: {}, transitionSequence: 1, answeredQuestionIds: ["C01", "C02"], askedQuestionIds: ["C01", "C02"] });
assert.equal(resumed.nextQuestionId, "C03");
assert.deepEqual(resumed, resumedAgain);

for (const question of [questionBank.commonType[0], wc[0], questionBank.defense[0]]) {
  assert.deepEqual(orderQuestionOptions(question, "same").map((o) => o.id), orderQuestionOptions(question, "same").map((o) => o.id));
}
assert.deepEqual(orderQuestionOptions(questionBank.genericExpression[0], "one").map((o) => o.id), orderQuestionOptions(questionBank.genericExpression[0], "two").map((o) => o.id));
const nonRandomSingleChoice: QuestionDefinition = { ...questionBank.commonType[0], id: "X", block: "expression" };
assert.deepEqual(orderQuestionOptions(nonRandomSingleChoice, "seed").map((o) => o.id), nonRandomSingleChoice.options.map((o) => o.id));
assert.throws(() => orderQuestionOptions(questionBank.commonType[0], ""), /seed/i);
assert.throws(() => orderQuestionOptions(questionBank.commonType[0], undefined), /seed/i);

const reordered = orderQuestionOptions(questionBank.commonType[0], "meaning-seed");
const selectedId = reordered[0].id;
const semanticAnswer: AnswerRecord = { questionId: "C01", questionVersion: questionBank.commonType[0].version, optionId: selectedId, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
const scores = scoreBaseTypes([questionBank.commonType[0]], [semanticAnswer]);
assert.equal(scores[questionBank.commonType[0].options.find((option) => option.id === selectedId)!.typeId!], 1);

console.log("routing state, budget, transition, and seed contract tests passed");
