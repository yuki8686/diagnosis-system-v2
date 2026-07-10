import { ENGINE_VERSION, LIMITS, QUESTION_BANK_VERSION, REPORT_TEMPLATE_VERSION, SCORING_VERSION } from "./constants";
import { questionBank } from "./data/question-bank";
import type { ChoiceOption, ComparisonResolution, ConfirmationActivationReason, ConfirmationKind, ConfirmationSkipReason, DiagnosisRoute, DiagnosisRouteKind, DiagnosisStep, QuestionDefinition, TypeResolution } from "./types";

export interface RouteConfirmationNeeds {
  expression?: boolean;
  utilization?: boolean;
  gap?: boolean;
}

export interface BuildDiagnosisRouteInput {
  sessionId: string;
  resolution: TypeResolution;
  comparison?: ComparisonResolution;
  confirmationNeeds: RouteConfirmationNeeds;
  answeredQuestionIds?: string[];
  askedQuestionIds?: string[];
  sessionSeed: string;
  previousState?: DiagnosisRoute;
  transitionSequence: number;
  transitionReason?: string;
  transitionTriggeringQuestionIds?: string[];
}

const ids = (questions: QuestionDefinition[]): string[] => questions.map((question) => question.id);
const baseItems = (questions: QuestionDefinition[]): QuestionDefinition[] => questions.filter((question) => !question.isConfirmation);
const confirmationItems = (questions: QuestionDefinition[]): QuestionDefinition[] => questions.filter((question) => question.isConfirmation);

function comparisonIds(comparison: ComparisonResolution | undefined): string[] {
  if (!comparison) return [];
  const answered = comparison.rawAnswers.map((answer) => answer.questionId);
  return comparison.status === "needs_more" ? [...answered, ...comparison.nextQuestionIds] : answered;
}

function lowConfidenceUtilization(candidates: TypeResolution & { kind: "low-confidence" }): string[] {
  return candidates.candidates.slice(0, 2).flatMap((typeId) => {
    const section = questionBank.byType[typeId].utilization;
    const wanted = typeId === "win"
      ? ["U-A1", "U-R1", "U-O1"]
      : typeId === "connect"
        ? ["T-U-A1", "T-U-R1", "T-U-O1"]
        : typeId === "analyze"
          ? ["R-U-A1", "R-U-R1", "R-U-O1"]
          : ["J-U-A1", "J-U-R1", "J-U-O1"];
    const available = new Set(section.map((question) => question.id));
    if (!wanted.every((questionId) => available.has(questionId))) throw new Error(`Low-confidence utilization set is incomplete for ${typeId}`);
    return wanted;
  });
}

function stepFor(questionId: string | undefined, activatedQuestionIds: Set<string>): DiagnosisStep {
  if (!questionId) return "complete";
  if (activatedQuestionIds.has(questionId)) return "confirmation";
  const all = [
    ...questionBank.commonType,
    ...Object.values(questionBank.comparisons).flat(),
    ...questionBank.genericExpression,
    ...questionBank.defense,
    ...questionBank.genericGap,
    ...Object.values(questionBank.byType).flatMap((section) => [...section.expression, ...section.gap, ...section.utilization]),
  ];
  const question = all.find((item) => item.id === questionId);
  if (!question) throw new Error(`Unknown route question: ${questionId}`);
  if (question.block === "common-type") return "common-type";
  if (question.block === "type-comparison") return "comparison";
  if (question.block === "expression" || question.block === "generic-expression") return "expression";
  if (question.block === "defense") return "defense";
  if (question.block.includes("gap")) return "gap";
  return "utilization";
}

export function buildDiagnosisRoute(input: BuildDiagnosisRouteInput): DiagnosisRoute {
  if (!input.sessionId?.trim()) throw new Error("sessionId is required");
  if (!input.sessionSeed?.trim()) throw new Error("sessionSeed is required");
  if (!Number.isInteger(input.transitionSequence) || input.transitionSequence < 1) throw new Error("transitionSequence must be a positive integer");
  if (input.previousState && (input.previousState.sessionId !== input.sessionId || input.previousState.sessionSeed !== input.sessionSeed)) throw new Error("Previous routing state belongs to a different session");
  if (input.previousState && (input.previousState.questionBankVersion !== QUESTION_BANK_VERSION || input.previousState.scoringVersion !== SCORING_VERSION || input.previousState.engineVersion !== ENGINE_VERSION || input.previousState.reportTemplateVersion !== REPORT_TEMPLATE_VERSION)) throw new Error("Historical routing state version is read-only");
  const lockedRoute = input.previousState?.routeLocked === true;
  const effectiveResolution = lockedRoute ? input.previousState!.typeResolution : input.resolution;
  const effectiveComparison = lockedRoute ? input.previousState!.comparison : input.comparison;
  const comparison = comparisonIds(effectiveComparison);
  const answeredQuestionIds = [...(input.answeredQuestionIds ?? [])];
  const askedQuestionIds = [...(input.askedQuestionIds ?? input.previousState?.askedQuestionIds ?? [])];
  const activatedConfirmations: ConfirmationKind[] = [...(input.previousState?.activatedConfirmations ?? [])];
  const skippedConfirmations: ConfirmationKind[] = [];
  const confirmationActivationReasons: DiagnosisRoute["confirmationActivationReasons"] = { ...(input.previousState?.confirmationActivationReasons ?? {}) };
  const confirmationSkipReasons: DiagnosisRoute["confirmationSkipReasons"] = {};
  const confirmationConfidenceHints: Partial<Record<ConfirmationKind, "low">> = {};
  const confirmationQuestionIds: string[] = [];
  let questionIds: string[];
  let confirmationCandidates: Array<[ConfirmationKind, string[]]>;
  let targetRoute: DiagnosisRouteKind = effectiveComparison?.status === "needs_more" ? "pending-comparison" : effectiveResolution.kind === "resolved" ? "resolved" : "low-confidence";
  if (lockedRoute) targetRoute = input.previousState!.route;

  const transitionHistory = [...(input.previousState?.transitionHistory ?? [])];
  const previousRoute = input.previousState?.route ?? "uninitialized";
  if (previousRoute !== targetRoute) {
    transitionHistory.push({ from: previousRoute, to: targetRoute, reason: input.transitionReason ?? (lockedRoute ? "route_locked" : "resolution_updated"), sequence: input.transitionSequence, triggeringQuestionIds: [...(input.transitionTriggeringQuestionIds ?? [])] });
  }
  const routeLocked = lockedRoute || targetRoute !== "pending-comparison";
  const routeLockedAt = input.previousState?.routeLockedAt ?? (routeLocked ? input.transitionSequence : undefined);

  const finalize = (basePlannedCount: number, structuralComparisonCount: number, consumedConditionalCount: number): Omit<DiagnosisRoute, "currentStep" | "nextQuestionId"> => {
    if (new Set(questionIds).size !== questionIds.length) throw new Error("Diagnosis route contains duplicate question ids");
    if (new Set(answeredQuestionIds).size !== answeredQuestionIds.length) throw new Error("answeredQuestionIds contains duplicates");
    if (new Set(askedQuestionIds).size !== askedQuestionIds.length) throw new Error("askedQuestionIds contains duplicates");
    const remainingOperationalBudget = Math.max(0, LIMITS.operationalMaximumQuestions - questionIds.length);
    const routeConfirmationCap = targetRoute === "low-confidence" ? 2 : 6;
    const remainingConditionalBudget = Math.max(0, Math.min(routeConfirmationCap - consumedConditionalCount, LIMITS.operationalMaximumQuestions - basePlannedCount - structuralComparisonCount - consumedConditionalCount));
    return {
      sessionId: input.sessionId,
      sessionSeed: input.sessionSeed,
      questionBankVersion: QUESTION_BANK_VERSION,
      scoringVersion: SCORING_VERSION,
      engineVersion: ENGINE_VERSION,
      reportTemplateVersion: REPORT_TEMPLATE_VERSION,
      route: targetRoute,
      routeLocked,
      routeLockedAt,
      typeResolution: effectiveResolution,
      comparisonPhase: effectiveComparison?.phase,
      expectedComparisonPair: effectiveComparison?.pair,
      questionIds,
      askedQuestionIds,
      answeredQuestionIds,
      provisionalType: effectiveResolution.kind === "resolved" ? effectiveResolution.primary : effectiveResolution.candidates[0],
      comparison: effectiveComparison,
      activatedConfirmations,
      confirmationActivationReasons,
      skippedConfirmations,
      confirmationSkipReasons,
      confirmationConfidenceHints,
      operationalLimit: 47,
      hardLimit: 48,
      basePlannedCount,
      structuralComparisonCount,
      consumedConditionalCount,
      remainingOperationalBudget,
      remainingConditionalBudget,
      remainingAdditionalBudget: remainingConditionalBudget,
      limits: { operationalMaximum: 47, hardMaximum: 48 },
      transitionHistory,
    };
  };

  if (targetRoute === "pending-comparison") {
    questionIds = [...ids(questionBank.commonType), ...comparison];
    const answered = new Set(answeredQuestionIds);
    const nextQuestionId = questionIds.find((questionId) => !answered.has(questionId));
    const base = finalize(39, comparison.length, 0);
    return {
      ...base,
      currentStep: stepFor(nextQuestionId, new Set()),
      nextQuestionId,
    };
  }

  if (effectiveResolution.kind === "resolved") {
    const section = questionBank.byType[effectiveResolution.primary];
    questionIds = [
      ...ids(questionBank.commonType),
      ...comparison,
      ...ids(baseItems(section.expression)),
      ...ids(questionBank.defense),
      ...ids(baseItems(section.gap)),
      ...ids(baseItems(section.utilization)),
    ];
    confirmationCandidates = [
      ["expression", ids(confirmationItems(section.expression))],
      ["utilization", ids(confirmationItems(section.utilization))],
      ["gap", ids(confirmationItems(section.gap))],
    ];
  } else {
    questionIds = [
      ...ids(questionBank.commonType),
      ...comparison,
      ...ids(questionBank.genericExpression),
      ...ids(questionBank.defense),
      ...ids(baseItems(questionBank.genericGap)),
      ...lowConfidenceUtilization(effectiveResolution),
    ];
    confirmationCandidates = [["gap", ids(confirmationItems(questionBank.genericGap))]];
  }

  const reasonFor: Record<ConfirmationKind, ConfirmationActivationReason> = { expression: "expression_mid_band", utilization: "utilization_contradiction", gap: "gap_direction_unclear" };
  const defaultSkip: Record<ConfirmationKind, ConfirmationSkipReason> = { expression: "not_applicable", utilization: "no_contradiction", gap: "not_applicable" };
  const candidateMap = new Map(confirmationCandidates);
  for (const kind of activatedConfirmations) {
    const candidateIds = candidateMap.get(kind);
    if (candidateIds) confirmationQuestionIds.push(...candidateIds);
  }
  for (const kind of ["expression", "utilization", "gap"] as const) {
    const candidateIds = candidateMap.get(kind);
    if (activatedConfirmations.includes(kind)) {
      if (input.confirmationNeeds[kind]) confirmationSkipReasons[kind] = "already_activated";
      continue;
    }
    if (!input.confirmationNeeds[kind]) {
      confirmationSkipReasons[kind] = defaultSkip[kind];
      continue;
    }
    if (!candidateIds) {
      skippedConfirmations.push(kind);
      confirmationSkipReasons[kind] = "route_disallowed";
      confirmationConfidenceHints[kind] = "low";
      continue;
    }
    const nextSize = questionIds.length + confirmationQuestionIds.length + candidateIds.length;
    if (candidateIds.length === 2 && nextSize <= LIMITS.hardMaximumQuestions && nextSize <= LIMITS.operationalMaximumQuestions) {
      activatedConfirmations.push(kind);
      confirmationActivationReasons[kind] = reasonFor[kind];
      confirmationQuestionIds.push(...candidateIds);
    } else {
      skippedConfirmations.push(kind);
      confirmationSkipReasons[kind] = "budget_exceeded";
      confirmationConfidenceHints[kind] = "low";
    }
  }
  questionIds = [...questionIds, ...confirmationQuestionIds];
  if (questionIds.length > LIMITS.operationalMaximumQuestions || questionIds.length > LIMITS.hardMaximumQuestions) throw new Error("Diagnosis route exceeds question limits");
  const answered = new Set(answeredQuestionIds);
  const nextQuestionId = questionIds.find((questionId) => !answered.has(questionId));
  const activatedSet = new Set(confirmationQuestionIds);
  const base = finalize(39, comparison.length, confirmationQuestionIds.length);
  return {
    ...base,
    currentStep: stepFor(nextQuestionId, activatedSet),
    nextQuestionId,
  };
}

function seedHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function orderQuestionOptions(question: QuestionDefinition, sessionSeed?: string): ChoiceOption[] {
  if (!sessionSeed?.trim()) throw new Error("A non-empty session seed is required");
  if (question.format === "likert-5" || !["common-type", "type-comparison", "defense"].includes(question.block)) return [...question.options];
  const ordered = [...question.options];
  const random = randomFromSeed(seedHash(`${sessionSeed}:${question.id}`));
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [ordered[index], ordered[selected]] = [ordered[selected], ordered[index]];
  }
  return ordered;
}
