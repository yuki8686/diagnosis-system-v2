import { strict as assert } from "node:assert";
import { flattenQuestionBank } from "../src/data/question-bank-contract";
import { questionBank } from "../src/data/question-bank";
import { generateFreeReport, generatePaidReport, resultLabel } from "../src/report";
import { buildDiagnosisRoute } from "../src/routing";
import { aggregateComparison, buildDiagnosisResult, resolveType, scoreBaseTypes } from "../src/scoring";
import type { AnswerRecord, ComparisonResolution, DiagnosisRoute, QuestionDefinition, ReportInput, TypeId, TypeResolution } from "../src/types";

const all = flattenQuestionBank(questionBank);
const byId = new Map(all.map((question) => [question.id, question]));

function answer(question: QuestionDefinition, optionId: string, numericValue?: number): AnswerRecord {
  return { questionId: question.id, questionVersion: question.version, optionId, numericValue, answeredAt: "2026-07-11T02:00:00.000Z", durationMs: 5000 };
}

function commonAnswers(types: TypeId[]): AnswerRecord[] {
  return questionBank.commonType.map((question, index) => answer(question, question.options.find((option) => option.typeId === types[index])!.id));
}

function comparisonAnswer(questionId: string, typeId: TypeId): AnswerRecord {
  const question = byId.get(questionId)!;
  return answer(question, question.options.find((option) => option.typeId === typeId)!.id);
}

function plannedAnswer(question: QuestionDefinition, defenseIndex: number): AnswerRecord {
  if (question.block === "defense") {
    const categories = ["distance", "prove", "prove", "prove", "distance", "analyze", "analyze"] as const;
    const option = question.options.find((candidate) => candidate.defenseCategory === categories[defenseIndex])!;
    return answer(question, option.id);
  }
  if (question.format === "single-choice") return answer(question, question.options[0].id);
  let value = 4;
  if (question.metric === "expression") value = question.polarity === "negative" ? 2 : 5;
  else if (question.metric === "gap") value = question.block === "gap-public" || question.block === "generic-gap-public" ? 5 : 1;
  else if (question.block === "utilization") value = question.polarity === "reverse" ? 2 : 4;
  return answer(question, String(value), value);
}

function completeInput(sessionId: string, resolution: TypeResolution, common: AnswerRecord[], comparison: ComparisonResolution | undefined): ReportInput {
  const route = buildDiagnosisRoute({ sessionId, sessionSeed: `${sessionId}-seed`, resolution, comparison, confirmationNeeds: {}, transitionSequence: 2, transitionReason: "type_resolution_derived" });
  const existing = new Map([...common, ...(comparison?.rawAnswers.map((raw) => comparisonAnswer(raw.questionId, raw.selectedType)) ?? [])].map((item) => [item.questionId, item]));
  let defenseIndex = 0;
  const questions = route.questionIds.map((id) => byId.get(id)!);
  const answers = questions.map((question) => {
    const known = existing.get(question.id);
    if (known) return known;
    const generated = plannedAnswer(question, defenseIndex);
    if (question.block === "defense") defenseIndex += 1;
    return generated;
  });
  const result = buildDiagnosisResult({ questions, answers, routingState: route, expressionIsGeneric: resolution.kind === "low-confidence", typeFitSignals: { fitItemLow: false, baseMarginSmall: resolution.kind === "low-confidence", secondFitSignalLow: false } });
  return { result, route, answers, questions };
}

function assertReportResolution(input: ReportInput): void {
  const free = generateFreeReport(input);
  const paid = generatePaidReport(input, free);
  assert.deepEqual(input.route.typeResolution, input.result.resolution);
  assert.equal(free.label, resultLabel(input.result));
  assert.equal(paid.label, resultLabel(input.result));
  assert.equal(paid.qualityGate.passed, true);
  assert.deepEqual(generateFreeReport(input), free);
  assert.deepEqual(generatePaidReport(input, free), paid);
}

// Full E2E 1: common answers resolve without comparison.
const clearCommon = commonAnswers(["win", "win", "win", "win", "win", "win", "win", "connect", "connect", "connect", "analyze", "axis"]);
const clearBase = scoreBaseTypes(questionBank.commonType, clearCommon);
const clearResolution = resolveType(clearBase);
assert.deepEqual(clearResolution, { kind: "resolved", primary: "win", secondary: "connect", source: "base" });
const clearInput = completeInput("full-base", clearResolution, clearCommon, undefined);
assert.equal(clearInput.route.comparison, undefined);
assertReportResolution(clearInput);

const closeCommon = commonAnswers(["win", "win", "win", "win", "win", "connect", "connect", "connect", "connect", "analyze", "analyze", "axis"]);
const closeBase = scoreBaseTypes(questionBank.commonType, closeCommon);
const comparisonNeed = resolveType(closeBase);
assert.equal(comparisonNeed.kind, "low-confidence");
assert.equal(comparisonNeed.kind === "low-confidence" && comparisonNeed.candidates.length, 2, "two candidates signal that pair comparison is required");
const pairQuestions = questionBank.comparisons["connect-win"];
const initialAnswers = [comparisonAnswer("VS-WC-1", "win"), comparisonAnswer("VS-WC-2", "connect")];
const initialComparison = aggregateComparison(pairQuestions, { expectedPair: ["win", "connect"], initialQuestionIds: ["VS-WC-1", "VS-WC-2"], additionalQuestionIds: ["VS-WC-3", "VS-WC-4"], answers: initialAnswers, phase: "initial" });
assert.equal(initialComparison.status, "needs_more");
assert.deepEqual(initialComparison.nextQuestionIds, ["VS-WC-3", "VS-WC-4"]);
const pendingRouteA = buildDiagnosisRoute({ sessionId: "full-pending", sessionSeed: "full-pending-seed", resolution: comparisonNeed, comparison: initialComparison, confirmationNeeds: {}, answeredQuestionIds: [...closeCommon.map((item) => item.questionId), ...initialAnswers.map((item) => item.questionId)], transitionSequence: 1 });
const pendingRouteB = buildDiagnosisRoute({ sessionId: "full-pending", sessionSeed: "full-pending-seed", resolution: comparisonNeed, comparison: initialComparison, confirmationNeeds: {}, answeredQuestionIds: [...closeCommon.map((item) => item.questionId), ...initialAnswers.map((item) => item.questionId)], transitionSequence: 1 });
assert.equal(pendingRouteA.nextQuestionId, "VS-WC-3");
assert.equal(pendingRouteA.nextQuestionId, pendingRouteB.nextQuestionId);

// Full E2E 2: initial 1-1, then 3-1 resolves through comparison.
const resolvedComparisonAnswers = [...initialAnswers, comparisonAnswer("VS-WC-3", "win"), comparisonAnswer("VS-WC-4", "win")];
const resolvedComparison = aggregateComparison(pairQuestions, { expectedPair: ["win", "connect"], initialQuestionIds: ["VS-WC-1", "VS-WC-2"], additionalQuestionIds: ["VS-WC-3", "VS-WC-4"], answers: resolvedComparisonAnswers, phase: "completed" });
assert.equal(resolvedComparison.status, "resolved");
const comparedResolution = resolveType(closeBase, resolvedComparison);
assert.deepEqual(comparedResolution, { kind: "resolved", primary: "win", secondary: "connect", source: "comparison" });
const comparedInput = completeInput("full-comparison-resolved", comparedResolution, closeCommon, resolvedComparison);
assert.equal(comparedInput.result.resolution.kind === "resolved" && comparedInput.result.resolution.source, "comparison");
assertReportResolution(comparedInput);

// Full E2E 3: initial 1-1, then 2-2 locks the low-confidence route.
const tiedComparisonAnswers = [...initialAnswers, comparisonAnswer("VS-WC-3", "win"), comparisonAnswer("VS-WC-4", "connect")];
const tiedComparison = aggregateComparison(pairQuestions, { expectedPair: ["win", "connect"], initialQuestionIds: ["VS-WC-1", "VS-WC-2"], additionalQuestionIds: ["VS-WC-3", "VS-WC-4"], answers: tiedComparisonAnswers, phase: "completed" });
assert.equal(tiedComparison.status, "low_confidence");
const tiedResolution = resolveType(closeBase, tiedComparison);
assert.equal(tiedResolution.kind, "low-confidence");
const tiedInput = completeInput("full-comparison-low", tiedResolution, closeCommon, tiedComparison);
const tiedFree = generateFreeReport(tiedInput);
const tiedPaid = generatePaidReport(tiedInput, tiedFree);
assert.equal(tiedInput.route.routeLocked, true);
assert.equal(tiedInput.route.route, "low-confidence");
assert.equal(tiedFree.route, "low_confidence");
assert.equal(tiedPaid.label, "戦車 × 太陽", "a low-confidence result lists the two Arcana candidates without changing the route");
assert.doesNotMatch(tiedPaid.label, /・/);
const comparisonParagraph = tiedPaid.sections.find((section) => section.id === "core_desire")!.paragraphs.find((paragraph) => paragraph.id === "low-comparison-answer")!;
assert.ok(comparisonParagraph.evidence.sourceQuestionIds[0].startsWith("VS-WC-"));
assert.equal(tiedPaid.qualityGate.passed, true);
assert.deepEqual(generatePaidReport(tiedInput, tiedFree), tiedPaid);

console.log("full answer-to-resolution report E2E scenarios passed");
