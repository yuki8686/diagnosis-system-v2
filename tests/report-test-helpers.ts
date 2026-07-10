import { ENGINE_VERSION, QUESTION_BANK_VERSION, REPORT_TEMPLATE_VERSION, SCORING_VERSION } from "../src/constants";
import { flattenQuestionBank } from "../src/data/question-bank-contract";
import { questionBank } from "../src/data/question-bank";
import type {
  AnswerRecord,
  Confidence,
  DefenseCategory,
  DiagnosisResult,
  DiagnosisRoute,
  ExpressionId,
  ReportInput,
  TypeId,
} from "../src/types";

const allQuestions = flattenQuestionBank(questionBank);
const questionById = new Map(allQuestions.map((question) => [question.id, question]));

function answer(questionId: string, optionId?: string, numericValue?: number): AnswerRecord {
  const question = questionById.get(questionId);
  if (!question) throw new Error(`Missing report fixture question: ${questionId}`);
  const selected = optionId ?? question.options[0].id;
  return {
    questionId,
    questionVersion: question.version,
    optionId: selected,
    numericValue,
    answeredAt: "2026-07-11T00:00:00.000Z",
    durationMs: 5000,
  };
}

const defenseCategories: DefenseCategory[] = ["counterattack", "prove", "distance", "self-efface", "analyze", "self-blame", "numb", "freeze"];
const zeroDefense = () => Object.fromEntries(defenseCategories.map((id) => [id, 0])) as Record<DefenseCategory, number>;
const opportunities = (): Record<DefenseCategory, number> => ({ counterattack: 5, prove: 5, distance: 5, "self-efface": 5, analyze: 3, "self-blame": 2, numb: 2, freeze: 1 });

export type ReportFixtureOptions = {
  type?: TypeId;
  expression?: ExpressionId;
  route?: "resolved" | "low-confidence";
  confidences?: Partial<Record<"type" | "expression" | "gap" | "defense" | "utilization", Confidence>>;
  defenseMode?: "primary" | "tie" | "low" | "opportunity-limited";
  gapPattern?: "small" | "suppression" | "amplification" | "reversal" | "unclear";
  utilizationGap?: number;
  confirmation?: boolean;
  reliabilityIssues?: DiagnosisResult["reliability"]["issues"];
  freeAnchorLimit?: 0 | 1 | 2;
};

export function makeReportInput(options: ReportFixtureOptions = {}): ReportInput {
  const primary = options.type ?? "win";
  const expression = options.expression ?? "outward";
  const reportRoute = options.route ?? "resolved";
  const gapPattern = options.gapPattern ?? "amplification";
  const confidence = {
    type: options.confidences?.type ?? (reportRoute === "resolved" ? "high" : "low"),
    expression: options.confidences?.expression ?? "high",
    gap: options.confidences?.gap ?? "high",
    defense: options.confidences?.defense ?? (options.defenseMode === "low" ? "low" : "high"),
    utilization: options.confidences?.utilization ?? "high",
  } as const;

  const typeAnswer = answer("C01", questionById.get("C01")!.options.find((item) => item.typeId === primary)!.id);
  const gapAnswers = [answer("Z1-H", "2", 2), answer("Z1-P", "5", 5)];
  const defenseQuestionId = options.defenseMode === "opportunity-limited" ? "D3" : "D1";
  const defenseQuestion = questionById.get(defenseQuestionId)!;
  const defenseOption = defenseQuestion.options.find((item) => item.defenseCategory === (options.defenseMode === "opportunity-limited" ? "freeze" : "analyze"))!;
  const defenseAnswer = answer(defenseQuestionId, defenseOption.id);
  const utilizationAnswer = answer("U-A1", "4", 4);
  const confirmationAnswers = options.confirmation ? [answer("DS-M1", "4", 4), answer("DS-M2", "5", 5)] : [];
  const answers = [typeAnswer, ...gapAnswers, defenseAnswer, utilizationAnswer, ...confirmationAnswers];
  const questions = answers.map((item) => questionById.get(item.questionId)!);

  const counts = zeroDefense();
  counts[defenseOption.defenseCategory!] = options.defenseMode === "low" || options.defenseMode === "opportunity-limited" ? 1 : 3;
  if (options.defenseMode === "tie") counts.distance = counts.analyze = 2;
  const primaryDefense = options.defenseMode === "low" || options.defenseMode === "tie" || options.defenseMode === "opportunity-limited" ? undefined : "analyze";
  const primaryTied: DefenseCategory[] = options.defenseMode === "tie" ? ["analyze", "distance"] : [];
  const gapDiff = gapPattern === "suppression" ? -3 : gapPattern === "small" ? 0 : 3;
  const gapDirection = gapPattern === "suppression" ? "negative" : gapPattern === "amplification" ? "positive" : gapPattern === "reversal" ? "mixed" : gapPattern === "small" ? "none" : "unclear";
  const gapStrength = gapPattern === "suppression" || gapPattern === "amplification" ? "strong" : null;
  const resolution = reportRoute === "resolved"
    ? { kind: "resolved" as const, primary, secondary: primary === "connect" ? "win" as const : "connect" as const, source: "base" as const }
    : { kind: "low-confidence" as const, candidates: ["win", "connect"] as [TypeId, TypeId] };

  const result: DiagnosisResult = {
    engineVersion: ENGINE_VERSION,
    scoringVersion: SCORING_VERSION,
    questionBankVersion: QUESTION_BANK_VERSION,
    reportTemplateVersion: REPORT_TEMPLATE_VERSION,
    metadata: { engineVersion: ENGINE_VERSION, scoringVersion: SCORING_VERSION, questionBankVersion: QUESTION_BANK_VERSION, reportTemplateVersion: REPORT_TEMPLATE_VERSION },
    resolution,
    baseTypeScores: { win: primary === "win" ? 7 : 1, connect: primary === "connect" ? 7 : 2, analyze: primary === "analyze" ? 7 : 1, axis: primary === "axis" ? 7 : 1 },
    expression: { pattern: expression, rawScore: 13, confidence: confidence.expression, requiresConfirmation: Boolean(options.confirmation), confirmationStatus: options.confirmation ? "resolved" : "not_needed", usedQuestionIds: confirmationAnswers.map((item) => item.questionId), isGeneric: reportRoute === "low-confidence" },
    gap: {
      pattern: gapPattern,
      direction: gapDirection,
      magnitude: Math.abs(gapDiff),
      directionConsistency: gapPattern === "reversal" || gapPattern === "unclear" ? 0.5 : 1,
      breadth: gapPattern === "small" ? 0 : 4,
      strength: gapStrength,
      pairs: [{ pairId: "Z1", inner: 2, public: 2 + gapDiff, diff: gapDiff, innerQuestionId: "Z1-H", publicQuestionId: "Z1-P" }],
      maxGapPair: { pairId: "Z1", inner: 2, public: 2 + gapDiff, diff: gapDiff, innerQuestionId: "Z1-H", publicQuestionId: "Z1-P" },
      confidence: confidence.gap,
      confirmationStatus: "not_needed",
      usedQuestionIds: ["Z1-H", "Z1-P"],
    },
    defense: {
      counts,
      primary: primaryDefense,
      tied: primaryTied,
      primaryTied,
      secondaryTied: [],
      confidence: confidence.defense,
      opportunities: opportunities(),
      selectionRates: zeroDefense(),
      opportunityLimited: ["analyze", "self-blame", "numb", "freeze"],
      observedReactions: [{ questionId: defenseQuestionId, category: defenseOption.defenseCategory! }],
      usedQuestionIds: [defenseQuestionId],
    },
    utilization: {
      awareness: 4,
      utilization: 4 - (options.utilizationGap ?? 0),
      awarenessBand: "high",
      utilizationBand: options.utilizationGap ? "growth" : "high",
      gap: options.utilizationGap ?? 0,
      confidence: confidence.utilization,
      requiresConfirmation: false,
      contradictionMetrics: [],
      confirmationStatus: "not_needed",
      usedQuestionIds: ["U-A1"],
    },
    typeFit: { incompatible: false, signals: { fitItemLow: false, baseMarginSmall: false, secondFitSignalLow: false } },
    reliability: { fastResponse: false, positionStreak: false, semanticMonotony: false, likertSameValueStreak: false, reverseContradiction: false, similarQuestionMismatch: false, issues: options.reliabilityIssues ?? [] },
    confidence,
    route: reportRoute,
    answeredQuestionIds: answers.map((item) => item.questionId),
  };

  const route: DiagnosisRoute = {
    sessionId: `report-${primary}-${expression}-${reportRoute}`,
    sessionSeed: "report-seed",
    questionBankVersion: QUESTION_BANK_VERSION,
    scoringVersion: SCORING_VERSION,
    engineVersion: ENGINE_VERSION,
    reportTemplateVersion: REPORT_TEMPLATE_VERSION,
    route: reportRoute === "resolved" ? "resolved" : "low-confidence",
    routeLocked: true,
    routeLockedAt: 1,
    typeResolution: resolution,
    currentStep: "complete",
    questionIds: answers.map((item) => item.questionId),
    askedQuestionIds: answers.map((item) => item.questionId),
    answeredQuestionIds: answers.map((item) => item.questionId),
    provisionalType: primary,
    activatedConfirmations: options.confirmation ? ["expression"] : [],
    confirmationActivationReasons: options.confirmation ? { expression: "expression_mid_band" } : {},
    skippedConfirmations: [], confirmationSkipReasons: {}, confirmationConfidenceHints: {},
    operationalLimit: 47, hardLimit: 48, basePlannedCount: answers.length, structuralComparisonCount: 0, consumedConditionalCount: confirmationAnswers.length,
    remainingOperationalBudget: 47 - answers.length, remainingConditionalBudget: 8, remainingAdditionalBudget: 8,
    limits: { operationalMaximum: 47, hardMaximum: 48 },
    transitionHistory: [{ from: "uninitialized", to: reportRoute === "resolved" ? "resolved" : "low-confidence", reason: "fixture", sequence: 1, triggeringQuestionIds: ["C01"] }],
  };
  return { result, route, answers, questions, freeAnchorLimit: options.freeAnchorLimit };
}
