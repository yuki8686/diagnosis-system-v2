import { LIMITS } from "./constants";
import { questionBank } from "./data/question-bank";
import type { ChoiceOption, ComparisonResolution, ConfirmationKind, DiagnosisRoute, DiagnosisStep, QuestionDefinition, TypeResolution } from "./types";

export interface RouteConfirmationNeeds {
  expression?: boolean;
  utilization?: boolean;
  gap?: boolean;
}

export interface BuildDiagnosisRouteInput {
  resolution: TypeResolution;
  comparison?: ComparisonResolution;
  confirmationNeeds: RouteConfirmationNeeds;
  answeredQuestionIds?: string[];
  sessionSeed: string;
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
  const comparison = comparisonIds(input.comparison);
  const answeredQuestionIds = [...(input.answeredQuestionIds ?? [])];
  const activatedConfirmations: ConfirmationKind[] = [];
  const skippedConfirmations: ConfirmationKind[] = [];
  const confirmationConfidenceHints: Partial<Record<ConfirmationKind, "low">> = {};
  const confirmationQuestionIds: string[] = [];
  let questionIds: string[];
  let confirmationCandidates: Array<[ConfirmationKind, string[]]>;

  if (input.comparison?.status === "needs_more") {
    questionIds = [...ids(questionBank.commonType), ...comparison];
    const answered = new Set(answeredQuestionIds);
    const nextQuestionId = questionIds.find((questionId) => !answered.has(questionId));
    return {
      route: "pending-comparison",
      currentStep: stepFor(nextQuestionId, new Set()),
      questionIds,
      answeredQuestionIds,
      nextQuestionId,
      provisionalType: input.resolution.kind === "resolved" ? input.resolution.primary : input.resolution.candidates[0],
      comparison: input.comparison,
      activatedConfirmations,
      skippedConfirmations,
      confirmationConfidenceHints,
      remainingAdditionalBudget: LIMITS.operationalMaximumQuestions - questionIds.length,
      sessionSeed: input.sessionSeed,
      limits: { operationalMaximum: 47, hardMaximum: 48 },
    };
  }

  if (input.resolution.kind === "resolved") {
    const section = questionBank.byType[input.resolution.primary];
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
      ...lowConfidenceUtilization(input.resolution),
    ];
    confirmationCandidates = [["gap", ids(confirmationItems(questionBank.genericGap))]];
  }

  for (const [kind, candidateIds] of confirmationCandidates) {
    if (!input.confirmationNeeds[kind]) continue;
    const nextSize = questionIds.length + confirmationQuestionIds.length + candidateIds.length;
    if (candidateIds.length === 2 && nextSize <= LIMITS.hardMaximumQuestions && nextSize <= LIMITS.operationalMaximumQuestions) {
      activatedConfirmations.push(kind);
      confirmationQuestionIds.push(...candidateIds);
    } else {
      skippedConfirmations.push(kind);
      confirmationConfidenceHints[kind] = "low";
    }
  }
  questionIds = [...questionIds, ...confirmationQuestionIds];
  if (questionIds.length > LIMITS.operationalMaximumQuestions || questionIds.length > LIMITS.hardMaximumQuestions) throw new Error("Diagnosis route exceeds question limits");
  const answered = new Set(answeredQuestionIds);
  const nextQuestionId = questionIds.find((questionId) => !answered.has(questionId));
  const routeConfirmationCap = input.resolution.kind === "resolved" ? 6 : 2;
  const remaining = Math.min(LIMITS.operationalMaximumQuestions - questionIds.length, routeConfirmationCap - confirmationQuestionIds.length);
  const activatedSet = new Set(confirmationQuestionIds);
  return {
    route: input.resolution.kind === "resolved" ? "resolved" : "low-confidence",
    currentStep: stepFor(nextQuestionId, activatedSet),
    questionIds,
    answeredQuestionIds,
    nextQuestionId,
    provisionalType: input.resolution.kind === "resolved" ? input.resolution.primary : input.resolution.candidates[0],
    comparison: input.comparison,
    activatedConfirmations,
    skippedConfirmations,
    confirmationConfidenceHints,
    remainingAdditionalBudget: remaining >= 2 ? remaining : 0,
    sessionSeed: input.sessionSeed,
    limits: { operationalMaximum: 47, hardMaximum: 48 },
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

export function orderQuestionOptions(question: QuestionDefinition, sessionSeed: string): ChoiceOption[] {
  if (question.format === "likert-5") return [...question.options];
  const ordered = [...question.options];
  const random = randomFromSeed(seedHash(`${sessionSeed}:${question.id}`));
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [ordered[index], ordered[selected]] = [ordered[selected], ordered[index]];
  }
  return ordered;
}
