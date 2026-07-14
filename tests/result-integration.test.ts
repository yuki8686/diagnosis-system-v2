import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { flattenQuestionBank } from "../src/data/question-bank-contract";
import { resultLabel } from "../src/report";
import { buildDiagnosisRoute } from "../src/routing";
import { aggregateComparison, buildDiagnosisResult, resolveType, scoreBaseTypes } from "../src/scoring";
import { finishDiagnosis, prepareDiagnosisCompletion } from "../src/ui/engine";
import { newSession } from "../src/ui/session";
import type { AnswerRecord, DiagnosisRoute, TypeId, TypeResolution } from "../src/types";

const all = flattenQuestionBank(questionBank);
const byId = new Map(all.map((question) => [question.id, question]));
const commonTypes: TypeId[] = ["win", "win", "win", "win", "win", "connect", "connect", "connect", "connect", "analyze", "analyze", "axis"];
const clearCommonTypes: TypeId[] = ["win", "win", "win", "win", "win", "win", "win", "connect", "connect", "connect", "analyze", "axis"];
const comparisonTypes: Record<string, TypeId> = { "VS-WC-1": "win", "VS-WC-2": "connect", "VS-WC-3": "win", "VS-WC-4": "win" };
const numericDefaults: Record<string, number> = {
  DS1: 5, DS2: 1, DS3: 5, "DS-FIT": 5,
  "U-A1": 4, "U-A2": 4, "U-R1": 1, "U-O1": 4, "U-O2": 4, "U-R2": 1,
};

const answerRoute = (route: DiagnosisRoute, overrides: Record<string, number> = {}): AnswerRecord[] => route.questionIds.map((questionId) => {
  const question = byId.get(questionId)!;
  assert.ok(question, questionId);
  if (question.block === "common-type") {
    const typeId = (route.comparison ? commonTypes : clearCommonTypes)[Number(question.id.slice(1)) - 1];
    const option = question.options.find((item) => item.typeId === typeId)!;
    return { questionId, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
  }
  if (question.block === "type-comparison") {
    const option = question.options.find((item) => item.typeId === comparisonTypes[questionId])!;
    return { questionId, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
  }
  if (question.format === "single-choice") return { questionId, questionVersion: question.version, optionId: question.options[0].id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
  const value = overrides[questionId] ?? numericDefaults[questionId] ?? 3;
  return { questionId, questionVersion: question.version, optionId: String(value), numericValue: value, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 };
});

const comparisonAnswers = ["VS-WC-1", "VS-WC-2", "VS-WC-3", "VS-WC-4"].map((id) => {
  const question = byId.get(id)!;
  const option = question.options.find((item) => item.typeId === comparisonTypes[id])!;
  return { questionId: id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 } satisfies AnswerRecord;
});
const comparison = aggregateComparison(questionBank.comparisons["connect-win"], { expectedPair: ["win", "connect"], initialQuestionIds: ["VS-WC-1", "VS-WC-2"], additionalQuestionIds: ["VS-WC-3", "VS-WC-4"], answers: comparisonAnswers, phase: "additional" });
const baseQuestions = questionBank.commonType;
const baseAnswers = questionBank.commonType.map((question, index) => {
  const option = question.options.find((item) => item.typeId === commonTypes[index])!;
  return { questionId: question.id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-10T00:00:00.000Z", durationMs: 5000 } satisfies AnswerRecord;
});
const baseScores = scoreBaseTypes(baseQuestions, baseAnswers);
const comparisonResolution = resolveType(baseScores, comparison);
assert.equal(comparisonResolution.kind, "resolved");

const routeFor = (sessionId: string, resolution: TypeResolution, confirmationNeeds: { expression?: boolean; utilization?: boolean; gap?: boolean }, withComparison = false) => buildDiagnosisRoute({
  sessionId, sessionSeed: `${sessionId}-seed`, resolution, comparison: withComparison ? comparison : undefined, confirmationNeeds, transitionSequence: 1,
});
const questionsFor = (route: DiagnosisRoute) => route.questionIds.map((id) => byId.get(id)!);
const fitSignals = { fitItemLow: false, baseMarginSmall: false, secondFitSignalLow: false };

const comparisonRoute = routeFor("comparison", comparisonResolution, {}, true);
const comparisonResult = buildDiagnosisResult({ questions: questionsFor(comparisonRoute), answers: answerRoute(comparisonRoute), routingState: comparisonRoute, expressionIsGeneric: false, typeFitSignals: fitSignals });
assert.deepEqual(comparisonResult.comparison, comparison);
assert.equal(comparisonResult.resolution.kind === "resolved" && comparisonResult.resolution.primary, "win");

const unclearGap = { "Z1-H": 1, "Z1-P": 2, "Z2-H": 1, "Z2-P": 2, "Z3-H": 2, "Z3-P": 1, "Z4-H": 3, "Z4-P": 3, "Z5-H": 3, "Z5-P": 3, "Z6-H": 1, "Z6-P": 2 };
const gapRoute = routeFor("gap", comparisonResolution, { gap: true }, true);
const gapResult = buildDiagnosisResult({ questions: questionsFor(gapRoute), answers: answerRoute(gapRoute, unclearGap), routingState: gapRoute, expressionIsGeneric: false, typeFitSignals: fitSignals });
assert.equal(gapResult.gap.pairs.length, 6);
assert.equal(gapResult.gap.pattern, "amplification");
assert.equal(gapResult.gap.confidence, "medium");

const baseResolved: TypeResolution = { kind: "resolved", primary: "win", secondary: "connect", source: "base" };
const utilizationRoute = routeFor("utilization", baseResolved, { utilization: true });
const utilizationOverrides = { "U-A1": 5, "U-A2": 5, "U-R1": 5, "U-O1": 4, "U-O2": 4, "U-R2": 1, "U-C1": 5, "U-C2": 4 };
const utilizationResult = buildDiagnosisResult({ questions: questionsFor(utilizationRoute), answers: answerRoute(utilizationRoute, utilizationOverrides), routingState: utilizationRoute, expressionIsGeneric: false, typeFitSignals: fitSignals });
assert.equal(utilizationResult.utilization.confirmationStatus, "resolved");
assert.equal(utilizationResult.utilization.confidence, "medium");

const expressionRoute = routeFor("expression", baseResolved, { expression: true });
const expressionOverrides = { DS1: 3, DS2: 3, DS3: 3, "DS-FIT": 5, "DS-M1": 4, "DS-M2": 5 };
const expressionResult = buildDiagnosisResult({ questions: questionsFor(expressionRoute), answers: answerRoute(expressionRoute, expressionOverrides), routingState: expressionRoute, expressionIsGeneric: false, typeFitSignals: fitSignals });
assert.equal(expressionResult.expression.pattern, "adaptive");
assert.equal(expressionResult.expression.confidence, "medium");
assert.equal(resultLabel(expressionResult), "魔術師", "the unchanged win/adaptive result maps to its approved Arcana display name");

const basicRoute = routeFor("basic", baseResolved, {});
const basicResult = buildDiagnosisResult({ questions: questionsFor(basicRoute), answers: answerRoute(basicRoute), routingState: basicRoute, expressionIsGeneric: false, typeFitSignals: fitSignals });
assert.equal(basicResult.gap.pairs.length, 5);
assert.equal(basicResult.utilization.confidence, "high");

const completionSession = { ...newSession(), sessionId: "basic", sessionSeed: "basic-seed", route: basicRoute, answers: answerRoute(basicRoute), currentQuestionIds: [...basicRoute.questionIds] };
const preparedCompletion = prepareDiagnosisCompletion(completionSession);
assert.deepEqual(preparedCompletion.currentQuestionIds, [], "a fully answered route is ready for the UI confirmation without generating a report");
assert.equal(preparedCompletion.freeReport, undefined, "the final confirmation check does not create a free report");
const finalizedCompletion = finishDiagnosis(completionSession);
assert.ok(finalizedCompletion.freeReport, "result generation remains available after the UI confirmation handoff");
const confirmationRequiredSession = { ...completionSession, answers: answerRoute(basicRoute, { DS1: 3, DS2: 3, DS3: 3, "DS-FIT": 5 }) };
const confirmationRequired = prepareDiagnosisCompletion(confirmationRequiredSession);
assert.deepEqual(confirmationRequired.currentQuestionIds, ["DS-M1", "DS-M2"], "the UI cannot reach final confirmation while route-level confirmation answers remain");
const invalidGapRoute = routeFor("invalid-gap", baseResolved, { gap: true });
assert.throws(() => buildDiagnosisResult({ questions: questionsFor(invalidGapRoute), answers: answerRoute(invalidGapRoute), routingState: invalidGapRoute, expressionIsGeneric: false, typeFitSignals: fitSignals }), /gap.*unclear|direction.*unclear/i);

const cappedRoute = routeFor("capped", comparisonResolution, { expression: true, utilization: true, gap: true }, true);
const cappedOverrides = { ...unclearGap, DS1: 3, DS2: 3, DS3: 3, "DS-M1": 4, "DS-M2": 5, ...utilizationOverrides };
const cappedResult = buildDiagnosisResult({ questions: questionsFor(cappedRoute), answers: answerRoute(cappedRoute, cappedOverrides), routingState: cappedRoute, expressionIsGeneric: false, typeFitSignals: fitSignals });
assert.equal(cappedRoute.confirmationSkipReasons.gap, "budget_exceeded");
assert.equal(cappedResult.gap.confirmationStatus, "skipped");
assert.equal(cappedResult.gap.confidence, "low");

assert.equal(basicResult.metadata.reportTemplateVersion, basicRoute.reportTemplateVersion);
assert.equal(basicResult.metadata.questionBankVersion, basicRoute.questionBankVersion);
assert.equal(basicResult.metadata.scoringVersion, basicRoute.scoringVersion);
assert.equal(basicResult.metadata.engineVersion, basicRoute.engineVersion);
assert.throws(() => buildDiagnosisResult({ questions: questionsFor(basicRoute), answers: answerRoute(basicRoute), routingState: { ...basicRoute, reportTemplateVersion: "" }, expressionIsGeneric: false, typeFitSignals: fitSignals }), /reportTemplateVersion/i);
assert.throws(() => buildDiagnosisResult({ questions: questionsFor(basicRoute), answers: answerRoute(basicRoute), routingState: { ...basicRoute, route: "low-confidence" }, expressionIsGeneric: false, typeFitSignals: fitSignals }), /route.*typeResolution|low-confidence/i);

console.log("comparison, confirmation, final-result, and version integration tests passed");
