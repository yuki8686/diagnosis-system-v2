import { strict as assert } from "node:assert";
import { flattenQuestionBank } from "../src/data/question-bank-contract";
import { questionBank } from "../src/data/question-bank";
import { generateFreeReport, generatePaidReport } from "../src/report";
import { buildDiagnosisRoute } from "../src/routing";
import { aggregateComparison, buildDiagnosisResult, scoreDefense } from "../src/scoring";
import type { AnswerRecord, DefenseCategory, DiagnosisRoute, ExpressionId, QuestionDefinition, ReportInput, TypeId, TypeResolution } from "../src/types";

const all = flattenQuestionBank(questionBank);
const byId = new Map(all.map((question) => [question.id, question]));
const commonResolved: TypeId[] = ["win", "win", "win", "win", "win", "win", "win", "connect", "connect", "connect", "analyze", "axis"];
const commonLow: TypeId[] = ["win", "win", "win", "win", "win", "connect", "connect", "connect", "connect", "analyze", "analyze", "axis"];

type EngineCase = {
  name: string;
  route?: "resolved" | "low-confidence";
  expression?: ExpressionId;
  gap?: "small" | "suppression" | "amplification" | "reversal" | "confirm";
  defense?: "high" | "tie" | "low";
  confirmation?: boolean;
  comparison?: boolean;
};

const defenseAnswers: Record<NonNullable<EngineCase["defense"]>, DefenseCategory[]> = {
  high: ["distance", "prove", "prove", "prove", "distance", "analyze", "analyze"],
  tie: ["counterattack", "prove", "prove", "analyze", "numb", "distance", "analyze"],
  low: ["counterattack", "numb", "freeze", "self-blame", "prove", "distance", "analyze"],
};

function numericFor(question: QuestionDefinition, config: EngineCase): number {
  if (question.metric === "fit") return 5;
  if (question.metric === "expression") {
    if (question.polarity === "switch") return 5;
    const expression = config.expression ?? "outward";
    if (expression === "outward") return question.polarity === "negative" ? 2 : 5;
    if (expression === "inward") return question.polarity === "negative" ? 5 : 2;
    return 3;
  }
  if (question.metric === "gap") {
    const isPublic = question.block === "gap-public" || question.block === "generic-gap-public";
    const pairNumber = Number(question.pairId?.match(/\d+/)?.[0] ?? 1);
    if (config.gap === "small") return 3;
    if (config.gap === "suppression") return isPublic ? 1 : 5;
    if (config.gap === "reversal") return pairNumber % 2 ? (isPublic ? 5 : 1) : (isPublic ? 1 : 5);
    if (config.gap === "confirm") {
      if (pairNumber === 1 || pairNumber === 2 || pairNumber === 6) return isPublic ? 4 : 2;
      if (pairNumber === 3) return isPublic ? 2 : 4;
      return 3;
    }
    return isPublic ? 5 : 1;
  }
  if (question.block === "utilization") return question.polarity === "reverse" ? 2 : 4;
  return 3;
}

function answerFor(question: QuestionDefinition, index: number, config: EngineCase, route: DiagnosisRoute): AnswerRecord {
  if (question.block === "common-type") {
    const typeId = (route.route === "low-confidence" ? commonLow : commonResolved)[Number(question.id.slice(1)) - 1];
    const option = question.options.find((candidate) => candidate.typeId === typeId)!;
    return { questionId: question.id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-11T01:00:00.000Z", durationMs: 5000 };
  }
  if (question.block === "type-comparison") {
    const selected: TypeId = question.id.endsWith("-1") || question.id.endsWith("-3") ? "win" : "connect";
    const option = question.options.find((candidate) => candidate.typeId === selected)!;
    return { questionId: question.id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-11T01:00:00.000Z", durationMs: 5000 };
  }
  if (question.block === "defense") {
    const defenseIndex = Number(question.id.slice(1)) - 1;
    const category = defenseAnswers[config.defense ?? "high"][defenseIndex];
    const option = question.options.find((candidate) => candidate.defenseCategory === category);
    assert.ok(option, `${question.id}/${category}`);
    return { questionId: question.id, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-11T01:00:00.000Z", durationMs: 5000 };
  }
  if (question.format === "single-choice") return { questionId: question.id, questionVersion: question.version, optionId: question.options[0].id, answeredAt: "2026-07-11T01:00:00.000Z", durationMs: 5000 };
  const value = numericFor(question, config);
  return { questionId: question.id, questionVersion: question.version, optionId: String(value), numericValue: value, answeredAt: "2026-07-11T01:00:00.000Z", durationMs: 5000 + index };
}

function engineInput(config: EngineCase): ReportInput {
  const low = config.route === "low-confidence";
  const resolution: TypeResolution = low
    ? { kind: "low-confidence", candidates: ["win", "connect"] }
    : { kind: "resolved", primary: "win", secondary: "connect", source: "base" };
  const comparisonQuestions = questionBank.comparisons["connect-win"];
  const comparison = config.comparison ? aggregateComparison(comparisonQuestions, {
    expectedPair: ["win", "connect"],
    initialQuestionIds: ["VS-WC-1", "VS-WC-2"],
    additionalQuestionIds: ["VS-WC-3", "VS-WC-4"],
    answers: comparisonQuestions.map((question, index) => answerFor(question, index, config, { route: "low-confidence" } as DiagnosisRoute)),
    phase: "completed",
  }) : undefined;
  const route = buildDiagnosisRoute({
    sessionId: `e2e-${config.name}`,
    sessionSeed: `seed-${config.name}`,
    transitionSequence: 1,
    resolution,
    comparison,
    confirmationNeeds: config.confirmation ? { expression: true } : config.gap === "confirm" ? { gap: true } : {},
  });
  const questions = route.questionIds.map((id) => {
    const question = byId.get(id);
    if (!question) throw new Error(`Missing E2E question: ${id}`);
    return question;
  });
  const answers = questions.map((question, index) => answerFor(question, index, config, route));
  const result = buildDiagnosisResult({ questions, answers, routingState: route, expressionIsGeneric: low, typeFitSignals: { fitItemLow: false, baseMarginSmall: low, secondFitSignalLow: false } });
  return { result, route, answers, questions };
}

const cases: EngineCase[] = [
  { name: "pattern-a", expression: "outward", gap: "amplification", defense: "high" },
  { name: "pattern-b", expression: "inward", gap: "suppression", defense: "high" },
  { name: "pattern-c", route: "low-confidence", expression: "adaptive", gap: "reversal", defense: "low" },
  { name: "confirmation", expression: "adaptive", gap: "amplification", defense: "high", confirmation: true },
  { name: "defense-high", expression: "outward", gap: "small", defense: "high" },
  { name: "defense-tie", expression: "outward", gap: "small", defense: "tie" },
  { name: "opportunity-limited", expression: "outward", gap: "small", defense: "low" },
  { name: "low-confidence", route: "low-confidence", expression: "adaptive", gap: "small", defense: "low" },
  { name: "comparison-low", route: "low-confidence", expression: "adaptive", gap: "reversal", defense: "low", comparison: true },
  { name: "gap-small", expression: "outward", gap: "small", defense: "high" },
  { name: "strong-suppression", expression: "inward", gap: "suppression", defense: "high" },
  { name: "strong-amplification", expression: "outward", gap: "amplification", defense: "high" },
  { name: "reversal", expression: "adaptive", gap: "reversal", defense: "tie", confirmation: true },
];

for (const config of cases) {
  const input = engineInput(config);
  assert.equal(input.result.expression.pattern, config.expression ?? "outward", `${config.name}: expression`);
  assert.equal(input.result.gap.pattern, config.gap === "confirm" ? "amplification" : config.gap ?? "amplification", `${config.name}: gap`);
  if (config.defense === "high") assert.equal(input.result.defense.confidence, "high", `${config.name}: defense confidence`);
  if (config.defense === "tie" || config.defense === "low") assert.equal(input.result.defense.confidence, "low", `${config.name}: defense confidence`);
  const free = generateFreeReport(input);
  const paid = generatePaidReport(input, free);
  const visible = `${free.summary}\n${free.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.text)).join("\n")}\n${paid.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.text)).join("\n")}`;
  for (const token of ["strong", "medium", "light", "not_needed", "resolved", "skipped", "low_confidence", "suppression", "amplification", "reversal", "growth"]) assert.doesNotMatch(visible, new RegExp(`(^|[^A-Za-z])${token}([^A-Za-z]|$)`), `${config.name}: ${token}`);
  assert.doesNotMatch(visible, /\b\d+\.\d+\b/, `${config.name}: raw decimal`);
  assert.equal(paid.qualityGate.passed, true, config.name);
  assert.equal(paid.metadata.sessionId, input.route.sessionId);
  assert.ok(paid.sections.flatMap((section) => section.paragraphs).filter((paragraph) => paragraph.evidence.evidenceLevel === "direct").flatMap((paragraph) => paragraph.evidence.sourceQuestionIds).length >= 3, config.name);
  if (config.defense === "high") assert.ok(paid.sections.find((section) => section.id === "defense")!.paragraphs.some((paragraph) => paragraph.claimKind === "primary_defense"), config.name);
  if (config.defense === "tie") assert.ok(paid.sections.find((section) => section.id === "defense")!.paragraphs.some((paragraph) => paragraph.claimKind === "defense_tie"), config.name);
  if (config.route === "low-confidence") assert.equal(paid.route, "low_confidence");
  if (config.name === "opportunity-limited") {
    assert.ok(input.result.defense.opportunityLimited.includes("freeze"));
    assert.ok(paid.sections.find((section) => section.id === "defense")!.paragraphs.some((paragraph) => paragraph.claimKind === "scenario_limited"));
  }
  if (config.comparison) {
    const comparisonParagraph = paid.sections.find((section) => section.id === "core_desire")!.paragraphs.find((paragraph) => paragraph.id === "low-comparison-answer")!;
    assert.ok(comparisonParagraph.evidence.sourceQuestionIds[0].startsWith("VS-"));
    assert.match(comparisonParagraph.text, /選んでいます/);
  }
}

const scoredDefense = scoreDefense(questionBank.defense, questionBank.defense.map((question, index) => answerFor(question, index, { name: "defense-contract", defense: "high" }, { route: "resolved" } as DiagnosisRoute)));
assert.deepEqual(scoredDefense.opportunities, { counterattack: 2, prove: 5, distance: 5, "self-efface": 5, analyze: 5, "self-blame": 3, numb: 2, freeze: 1 });
assert.deepEqual(scoredDefense.opportunityLimited, ["counterattack", "self-blame", "numb", "freeze"]);

console.log("branch-targeted engine/report fixture scenarios passed");
