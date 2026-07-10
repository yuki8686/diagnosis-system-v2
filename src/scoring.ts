import { DEFENSE_CATEGORIES, TYPE_IDS, type AnswerRecord, type ComparisonResolution, type ComparisonScores, type Confidence, type DefenseCategory, type DefenseResult, type DiagnosisResult, type ExpressionResult, type GapPairResult, type GapResult, type QuestionDefinition, type ReliabilityAssessment, type ReliabilityFlags, type TypeFitResult, type TypeId, type TypeResolution, type TypeScores, type UtilizationResult } from "./types";
import { ENGINE_VERSION, QUESTION_BANK_VERSION, SCORING_VERSION, THRESHOLDS } from "./constants";

const emptyTypeScores = (): TypeScores => ({ win: 0, connect: 0, analyze: 0, axis: 0 });

function answerMap(answers: AnswerRecord[]): Map<string, AnswerRecord> {
  return new Map(answers.map((answer) => [answer.questionId, answer]));
}

function numericAnswer(answer: AnswerRecord | undefined): number {
  if (!answer || answer.numericValue == null) throw new Error(`Numeric answer is missing: ${answer?.questionId ?? "unknown"}`);
  if (answer.numericValue < 1 || answer.numericValue > 5) throw new Error(`Likert answer out of range: ${answer.questionId}`);
  return answer.numericValue;
}

export function scoreBaseTypes(questions: QuestionDefinition[], answers: AnswerRecord[]): TypeScores {
  const scores = emptyTypeScores();
  const map = answerMap(answers);
  for (const question of questions.filter((q) => q.block === "common-type")) {
    const answer = map.get(question.id);
    if (!answer) continue;
    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option?.typeId) throw new Error(`Type option mapping is missing: ${question.id}/${answer.optionId}`);
    scores[option.typeId] += 1;
  }
  return scores;
}

function rankedTypes(scores: TypeScores): Array<[TypeId, number]> {
  return TYPE_IDS.map((id) => [id, scores[id]] as [TypeId, number]).sort((a, b) => b[1] - a[1]);
}

export function aggregateComparison(pair: [TypeId, TypeId], questions: QuestionDefinition[], answers: AnswerRecord[]): ComparisonResolution {
  const counts = emptyTypeScores();
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const answeredQuestionIds = new Set<string>();
  const rawAnswers = answers.map((answer) => {
    if (answeredQuestionIds.has(answer.questionId)) throw new Error(`Duplicate comparison answer: ${answer.questionId}`);
    answeredQuestionIds.add(answer.questionId);
    const question = questionMap.get(answer.questionId);
    if (!question) throw new Error(`Question is not part of comparison pair: ${answer.questionId}`);
    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option?.typeId || !pair.includes(option.typeId)) throw new Error(`Answer is outside comparison pair: ${answer.questionId}/${answer.optionId}`);
    counts[option.typeId] += 1;
    return { questionId: answer.questionId, selectedType: option.typeId };
  });
  const base = { pair, counts, rawAnswers };
  if (answers.length < 2) return { ...base, status: "needs_more", nextQuestionIds: questions.slice(answers.length, 2).map((question) => question.id) };
  if (answers.length === 2) {
    const winner = pair.find((typeId) => counts[typeId] === 2);
    if (winner) return { ...base, status: "resolved", winner, nextQuestionIds: [] };
    return { ...base, status: "needs_more", nextQuestionIds: questions.slice(2, 4).map((question) => question.id) };
  }
  if (answers.length < 4) return { ...base, status: "needs_more", nextQuestionIds: questions.slice(answers.length, 4).map((question) => question.id) };
  if (answers.length > 4) throw new Error("Comparison accepts at most four answers");
  const winner = pair.find((typeId) => counts[typeId] >= 3);
  return winner
    ? { ...base, status: "resolved", winner, nextQuestionIds: [] }
    : { ...base, status: "low_confidence", nextQuestionIds: [] };
}

export function resolveType(base: TypeScores, comparisons: ComparisonScores[] | ComparisonResolution = []): TypeResolution {
  const ranked = rankedTypes(base);
  const [first, second, third] = ranked;
  if (first[1] <= THRESHOLDS.type.flatTopMax || first[1] - third[1] <= THRESHOLDS.type.clusterTopToThirdMax) {
    return { kind: "low-confidence", candidates: [first[0], second[0], third[0]] };
  }
  if (first[1] - second[1] >= THRESHOLDS.type.clearMarginMin) {
    const secondary = second[1] >= THRESHOLDS.type.secondaryDisplayMin && second[1] > third[1] ? second[0] : undefined;
    return secondary
      ? { kind: "resolved", primary: first[0], secondary, source: "base" }
      : { kind: "resolved", primary: first[0], source: "base" };
  }
  const resolution = Array.isArray(comparisons)
    ? comparisons.find((item) => item.pair.includes(first[0]) && item.pair.includes(second[0]))?.winner
    : comparisons.status === "resolved" ? comparisons.winner : undefined;
  if (resolution) {
    const secondary = resolution === first[0] ? second[0] : first[0];
    return { kind: "resolved", primary: resolution, secondary, source: "comparison" };
  }
  return { kind: "low-confidence", candidates: [first[0], second[0]] };
}

export function scoreExpression(questions: QuestionDefinition[], answers: AnswerRecord[], isGeneric: boolean): ExpressionResult {
  const map = answerMap(answers);
  const items = questions.filter((q) => (isGeneric ? q.block === "generic-expression" : q.block === "expression") && q.metric === "expression" && !q.isConfirmation && (q.polarity === "positive" || q.polarity === "negative"));
  const values = items.map((q) => {
    const value = numericAnswer(map.get(q.id));
    return q.polarity === "negative" ? 6 - value : value;
  });
  if (values.length < 3) throw new Error("Expression scoring requires at least three scored items");
  const rawScore = values.reduce((sum, value) => sum + value, 0);
  const switchItems = questions.filter((q) => (isGeneric ? q.block === "generic-expression" : q.block === "expression") && q.polarity === "switch");
  const answeredSwitchValues = switchItems
    .map((q) => map.get(q.id))
    .filter((answer): answer is AnswerRecord => Boolean(answer))
    .map((answer) => numericAnswer(answer));
  const switchScore = answeredSwitchValues.length
    ? answeredSwitchValues.reduce((sum, value) => sum + value, 0) / answeredSwitchValues.length
    : undefined;
  let pattern: ExpressionResult["pattern"];
  let confidence: Confidence;
  let requiresConfirmation = false;
  let confirmationStatus: ExpressionResult["confirmationStatus"] = "not_needed";
  if (rawScore >= THRESHOLDS.expression.outwardMin) {
    pattern = "outward";
    confidence = "high";
  } else if (rawScore <= THRESHOLDS.expression.inwardMax) {
    pattern = "inward";
    confidence = "high";
  } else {
    requiresConfirmation = true;
    if (switchScore != null && switchScore >= 4) {
      pattern = "adaptive";
      confidence = "medium";
      confirmationStatus = "resolved";
    } else {
      pattern = rawScore >= 10 ? "outward" : "inward";
      confidence = "low";
      confirmationStatus = switchScore == null ? "pending" : "unresolved";
    }
  }
  return {
    pattern,
    rawScore,
    switchScore,
    confidence,
    requiresConfirmation,
    confirmationStatus,
    usedQuestionIds: [...items.map((q) => q.id), ...switchItems.filter((q) => map.has(q.id)).map((q) => q.id)],
    isGeneric,
  };
}

const median = (values: number[]): number => {
  if (!values.length) throw new Error("Median requires values");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export interface GapScoringOptions {
  includeConfirmation?: boolean;
  confirmationSkipped?: boolean;
}

export function scoreGap(questions: QuestionDefinition[], answers: AnswerRecord[], options: GapScoringOptions = {}): GapResult {
  const map = answerMap(answers);
  const pairs = new Map<string, { inner?: QuestionDefinition; public?: QuestionDefinition }>();
  for (const q of questions.filter((item) => item.metric === "gap" && item.pairId && (options.includeConfirmation || !item.isConfirmation))) {
    const current = pairs.get(q.pairId!) ?? {};
    if (q.block === "gap-inner" || q.block === "generic-gap-inner") current.inner = q;
    if (q.block === "gap-public" || q.block === "generic-gap-public") current.public = q;
    pairs.set(q.pairId!, current);
  }
  const results: GapPairResult[] = [];
  for (const [pairId, pair] of pairs) {
    if (!pair.inner || !pair.public) throw new Error(`Incomplete gap pair: ${pairId}`);
    const inner = numericAnswer(map.get(pair.inner.id));
    const publicValue = numericAnswer(map.get(pair.public.id));
    results.push({ pairId, inner, public: publicValue, diff: publicValue - inner, innerQuestionId: pair.inner.id, publicQuestionId: pair.public.id });
  }
  const magnitude = median(results.map((item) => Math.abs(item.diff)));
  const neg = results.filter((item) => item.diff <= -1).length;
  const pos = results.filter((item) => item.diff >= 1).length;
  const active = neg + pos;
  const consistency = active === 0 ? null : Math.max(neg, pos) / active;
  let pattern: GapResult["pattern"];
  if (magnitude <= 1 && active <= 1) pattern = "small";
  else if (neg >= 2 && pos >= 2) pattern = "reversal";
  else if (consistency != null && consistency >= 0.75 && neg > pos) pattern = "suppression";
  else if (consistency != null && consistency >= 0.75 && pos > neg) pattern = "amplification";
  else pattern = "unclear";
  const strength = pattern === "suppression" || pattern === "amplification" ? (magnitude >= 3 ? "strong" : magnitude >= 2 ? "medium" : "light") : null;
  const direction: GapResult["direction"] = pattern === "small"
    ? "none"
    : pattern === "suppression"
      ? "negative"
      : pattern === "amplification"
        ? "positive"
        : pattern === "reversal"
          ? "mixed"
          : "unclear";
  const maxGapPair = [...results].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  const confirmationStatus: GapResult["confirmationStatus"] = options.confirmationSkipped
    ? "skipped"
    : options.includeConfirmation
      ? pattern === "unclear" ? "unresolved" : "resolved"
      : pattern === "unclear" ? "pending" : "not_needed";
  const confidence: Confidence = options.confirmationSkipped || pattern === "unclear"
    ? "low"
    : options.includeConfirmation
      ? "medium"
      : "high";
  return {
    pattern,
    direction,
    magnitude,
    directionConsistency: consistency,
    breadth: active,
    strength,
    pairs: results,
    maxGapPair,
    confidence,
    confirmationStatus,
    usedQuestionIds: results.flatMap((item) => [item.innerQuestionId, item.publicQuestionId]),
  };
}

export function scoreDefense(questions: QuestionDefinition[], answers: AnswerRecord[]): DefenseResult {
  const map = answerMap(answers);
  const counts = Object.fromEntries(DEFENSE_CATEGORIES.map((id) => [id, 0])) as DefenseResult["counts"];
  const opportunities = Object.fromEntries(DEFENSE_CATEGORIES.map((id) => [id, 0])) as DefenseResult["opportunities"];
  for (const question of questions.filter((item) => item.block === "defense")) {
    for (const option of question.options) if (option.defenseCategory) opportunities[option.defenseCategory] += 1;
  }
  const usedQuestionIds: string[] = [];
  const observedReactions: DefenseResult["observedReactions"] = [];
  for (const q of questions.filter((item) => item.block === "defense")) {
    const answer = map.get(q.id);
    if (!answer) continue;
    const option = q.options.find((item) => item.id === answer.optionId);
    if (!option?.defenseCategory) throw new Error(`Defense mapping missing: ${q.id}/${answer.optionId}`);
    counts[option.defenseCategory] += 1;
    usedQuestionIds.push(q.id);
    observedReactions.push({ questionId: q.id, category: option.defenseCategory });
  }
  const selectionRates = Object.fromEntries(DEFENSE_CATEGORIES.map((id) => [id, opportunities[id] ? counts[id] / opportunities[id] : 0])) as DefenseResult["selectionRates"];
  const byRate = (a: DefenseCategory, b: DefenseCategory): number => selectionRates[b] - selectionRates[a] || DEFENSE_CATEGORIES.indexOf(a) - DEFENSE_CATEGORIES.indexOf(b);
  const ranked = DEFENSE_CATEGORIES.map((id) => [id, counts[id]] as const).sort((a, b) => b[1] - a[1] || byRate(a[0], b[0]));
  const max = ranked[0][1];
  const tied = ranked.filter((item) => item[1] === max && max > 0).map((item) => item[0]).sort(byRate);
  let primary: DefenseResult["primary"];
  let secondary: DefenseResult["secondary"];
  let secondaryTied: DefenseCategory[] = [];
  let confidence: Confidence = "low";
  if (tied.length === 1 && max >= 3) { primary = tied[0]; confidence = "high"; }
  else if (tied.length === 1 && max === 2) { primary = tied[0]; confidence = "medium"; }
  if (primary) {
    const remaining = ranked.filter((item) => item[0] !== primary);
    const secondMax = remaining[0]?.[1] ?? 0;
    if (secondMax >= 2) {
      const candidates = remaining.filter((item) => item[1] === secondMax).map((item) => item[0]).sort(byRate);
      if (candidates.length === 1) secondary = candidates[0];
      else secondaryTied = candidates;
    }
  }
  const primaryTied = primary ? [] : tied;
  const opportunityLimited = DEFENSE_CATEGORIES.filter((id) => opportunities[id] <= 3);
  return { counts, primary, secondary, tied, primaryTied, secondaryTied, confidence, opportunities, selectionRates, opportunityLimited, observedReactions, usedQuestionIds };
}

function band(value: number): UtilizationResult["awarenessBand"] {
  return value >= THRESHOLDS.utilization.highMin ? "high" : value >= THRESHOLDS.utilization.middleMin ? "middle" : "growth";
}

type UtilizationMetric = "awareness" | "utilization";

function utilizationContradictions(questions: QuestionDefinition[], answers: AnswerRecord[]): UtilizationMetric[] {
  const map = answerMap(answers);
  const relevant = questions.filter((question) => question.block === "utilization" && !question.isConfirmation);
  return (["awareness", "utilization"] as const).filter((metric) => {
    const metricItems = relevant.filter((question) => question.metric === metric);
    const positive = metricItems.filter((question) => question.polarity !== "reverse" && map.has(question.id)).map((question) => numericAnswer(map.get(question.id)));
    const reverseRaw = metricItems.filter((question) => question.polarity === "reverse" && map.has(question.id)).map((question) => numericAnswer(map.get(question.id)));
    if (!positive.length || !reverseRaw.length) return false;
    const positiveAverage = positive.reduce((sum, value) => sum + value, 0) / positive.length;
    const reverseAverage = reverseRaw.reduce((sum, value) => sum + value, 0) / reverseRaw.length;
    return positiveAverage >= 4 && reverseAverage >= 3.5;
  });
}

export function needsUtilizationConfirmation(questions: QuestionDefinition[], answers: AnswerRecord[]): boolean {
  return utilizationContradictions(questions, answers).length > 0;
}

export interface UtilizationScoringOptions {
  confirmationRequested?: boolean;
  confirmationSkipped?: boolean;
}

export function scoreUtilization(questions: QuestionDefinition[], answers: AnswerRecord[], options: UtilizationScoringOptions = {}): UtilizationResult {
  const map = answerMap(answers);
  const relevant = questions.filter((q) => q.block === "utilization" && !q.isConfirmation);
  const scored = (metric: "awareness" | "utilization") => relevant.filter((q) => q.metric === metric).map((q) => {
    const value = numericAnswer(map.get(q.id));
    return q.polarity === "reverse" ? 6 - value : value;
  });
  const awarenessValues = scored("awareness");
  const utilizationValues = scored("utilization");
  const awareness = awarenessValues.reduce((a, b) => a + b, 0) / awarenessValues.length;
  const utilization = utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length;
  const contradictionMetrics = utilizationContradictions(questions, answers);
  const requiresConfirmation = contradictionMetrics.length > 0;
  let confidence: Confidence = "high";
  let confirmationStatus: UtilizationResult["confirmationStatus"] = "not_needed";
  const usedQuestionIds = relevant.map((question) => question.id);
  if (requiresConfirmation) {
    confidence = "low";
    confirmationStatus = options.confirmationSkipped ? "skipped" : "pending";
    if (options.confirmationRequested) {
      const confirmations = questions.filter((question) => question.block === "utilization" && question.isConfirmation);
      const consistent = contradictionMetrics.every((metric) => {
        const item = confirmations.find((question) => question.metric === metric);
        if (!item) return false;
        const answer = map.get(item.id);
        if (!answer) return false;
        usedQuestionIds.push(item.id);
        return numericAnswer(answer) >= 4;
      });
      confidence = consistent ? "medium" : "low";
      confirmationStatus = consistent ? "resolved" : "unresolved";
    }
  }
  return { awareness, utilization, awarenessBand: band(awareness), utilizationBand: band(utilization), gap: awareness - utilization, confidence, requiresConfirmation, contradictionMetrics, confirmationStatus, usedQuestionIds };
}

export function detectReliability(questions: QuestionDefinition[], answers: AnswerRecord[]): ReliabilityFlags {
  const durations = answers.map((a) => a.durationMs).filter((n) => Number.isFinite(n));
  const fastResponse = durations.length > 0 && median(durations) < THRESHOLDS.reliability.medianFastResponseMs;
  let maxPositionRun = 0, currentPositionRun = 0, lastPosition: number | undefined;
  for (const answer of answers) {
    if (answer.displayedPosition != null && answer.displayedPosition === lastPosition) currentPositionRun += 1;
    else currentPositionRun = 1;
    lastPosition = answer.displayedPosition;
    maxPositionRun = Math.max(maxPositionRun, currentPositionRun);
  }
  const likertAnswers = answers.filter((a) => a.numericValue != null);
  let maxLikertRun = 0, currentLikertRun = 0, lastLikert: number | undefined;
  for (const answer of likertAnswers) {
    if (answer.numericValue === lastLikert) currentLikertRun += 1;
    else currentLikertRun = 1;
    lastLikert = answer.numericValue;
    maxLikertRun = Math.max(maxLikertRun, currentLikertRun);
  }
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  let maxSemanticRun = 0, currentSemanticRun = 0, lastSemantic: string | undefined;
  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    const option = question?.options.find((item) => item.id === answer.optionId);
    const semantic = option?.typeId ? `type:${option.typeId}` : option?.defenseCategory ? `defense:${option.defenseCategory}` : undefined;
    if (semantic && semantic === lastSemantic) currentSemanticRun += 1;
    else currentSemanticRun = semantic ? 1 : 0;
    lastSemantic = semantic;
    maxSemanticRun = Math.max(maxSemanticRun, currentSemanticRun);
  }
  const reverseContradiction = utilizationContradictions(questions, answers).length > 0;
  const map = answerMap(answers);
  const similarQuestionMismatch = questions.some((confirmation) => {
    if (!confirmation.isConfirmation || confirmation.polarity !== "positive" || (confirmation.metric !== "awareness" && confirmation.metric !== "utilization")) return false;
    const confirmationAnswer = map.get(confirmation.id);
    if (!confirmationAnswer) return false;
    const base = questions.filter((question) => !question.isConfirmation && question.targetType === confirmation.targetType && question.metric === confirmation.metric && question.polarity === "positive" && map.has(question.id));
    if (!base.length) return false;
    const average = base.map((question) => numericAnswer(map.get(question.id))).reduce((sum, value) => sum + value, 0) / base.length;
    return Math.abs(numericAnswer(confirmationAnswer) - average) >= 3;
  });
  return {
    fastResponse,
    positionStreak: maxPositionRun >= THRESHOLDS.reliability.positionRunLength,
    semanticMonotony: maxSemanticRun >= THRESHOLDS.reliability.positionRunLength,
    likertSameValueStreak: maxLikertRun >= THRESHOLDS.reliability.likertRunLength,
    reverseContradiction,
    similarQuestionMismatch,
  };
}

export function reliabilityAssessment(flags: ReliabilityFlags): ReliabilityAssessment {
  const mainSignalCount = [flags.fastResponse, flags.semanticMonotony, flags.likertSameValueStreak, flags.reverseContradiction, flags.similarQuestionMismatch].filter(Boolean).length;
  return {
    mainSignalCount,
    overallWeakening: mainSignalCount >= 2,
    blockContradictions: [
      ...(flags.reverseContradiction ? ["reverseContradiction" as const] : []),
      ...(flags.similarQuestionMismatch ? ["similarQuestionMismatch" as const] : []),
    ],
  };
}

export function evaluateTypeFit(signals: TypeFitResult["signals"]): TypeFitResult {
  return { incompatible: signals.fitItemLow && Boolean(signals.baseMarginSmall || signals.secondFitSignalLow || signals.blockInconsistency), signals };
}

export function deriveTypeFitSignals(questions: QuestionDefinition[], answers: AnswerRecord[], baseScores: TypeScores, targetType: TypeId): TypeFitResult["signals"] {
  const map = answerMap(answers);
  const fitItems = questions.filter((question) => question.targetType === targetType && question.metric === "fit" && map.has(question.id));
  const primaryFit = fitItems.find((question) => question.fitSignalRole === "primary") ?? fitItems[0];
  const secondaryFits = fitItems.filter((question) => question.id !== primaryFit?.id && question.fitSignalRole !== "block");
  const blockFits = fitItems.filter((question) => question.fitSignalRole === "block");
  const fitItemLow = primaryFit ? numericAnswer(map.get(primaryFit.id)) <= 2 : false;
  const secondFitSignalLow = secondaryFits.some((question) => numericAnswer(map.get(question.id)) <= 2);
  const ranked = rankedTypes(baseScores);
  const baseMarginSmall = ranked[0][1] - ranked[1][1] <= 2;
  const blockAverage = blockFits.length >= 2
    ? blockFits.map((question) => numericAnswer(map.get(question.id))).reduce((sum, value) => sum + value, 0) / blockFits.length
    : undefined;
  return {
    fitItemLow,
    baseMarginSmall,
    secondFitSignalLow,
    blockInconsistency: blockAverage != null && blockAverage <= 2,
  };
}

export function buildDiagnosisResult(args: {
  questions: QuestionDefinition[];
  answers: AnswerRecord[];
  comparisons?: ComparisonScores[];
  expressionIsGeneric: boolean;
  typeFitSignals?: TypeFitResult["signals"];
}): DiagnosisResult {
  const comparisons = args.comparisons ?? [];
  const baseTypeScores = scoreBaseTypes(args.questions, args.answers);
  const resolution = resolveType(baseTypeScores, comparisons);
  const expression = scoreExpression(args.questions, args.answers, args.expressionIsGeneric);
  const gap = scoreGap(args.questions, args.answers);
  const defense = scoreDefense(args.questions, args.answers);
  const utilization = scoreUtilization(args.questions, args.answers);
  const reliability = detectReliability(args.questions, args.answers);
  const fitTarget = resolution.kind === "resolved" ? resolution.primary : resolution.candidates[0];
  const typeFit = evaluateTypeFit(args.typeFitSignals ?? deriveTypeFitSignals(args.questions, args.answers, baseTypeScores, fitTarget));
  const majorReliability = reliabilityAssessment(reliability).overallWeakening;
  let typeConfidence: Confidence;
  if (resolution.kind === "low-confidence" || typeFit.incompatible || majorReliability) typeConfidence = "low";
  else if (resolution.source === "comparison") typeConfidence = "medium";
  else typeConfidence = "high";
  return {
    engineVersion: ENGINE_VERSION,
    scoringVersion: SCORING_VERSION,
    questionBankVersion: QUESTION_BANK_VERSION,
    resolution,
    baseTypeScores,
    comparisonScores: comparisons,
    expression,
    gap,
    defense,
    utilization,
    typeFit,
    reliability,
    confidence: { type: typeConfidence, expression: expression.confidence, gap: gap.confidence, defense: defense.confidence, utilization: utilization.confidence },
    route: resolution.kind === "resolved" ? "resolved" : "low-confidence",
    answeredQuestionIds: args.answers.map((answer) => answer.questionId),
  };
}
