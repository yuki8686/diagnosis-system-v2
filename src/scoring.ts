import { DEFENSE_CATEGORIES, TYPE_IDS, type AnswerRecord, type BlockConfidences, type ComparisonInput, type ComparisonResolution, type Confidence, type DefenseCategory, type DefenseResult, type DiagnosisBlock, type DiagnosisResult, type DiagnosisRoute, type ExpressionResult, type GapPairResult, type GapResult, type QuestionDefinition, type ReliabilityAssessment, type ReliabilityFlags, type ReliabilityIssue, type ResultMetadata, type TypeFitResult, type TypeId, type TypeResolution, type TypeScores, type UtilizationResult } from "./types";
import { ENGINE_VERSION, QUESTION_BANK_VERSION, REPORT_TEMPLATE_VERSION, SCORING_VERSION, THRESHOLDS } from "./constants";
import { validateAnswerRecords } from "./validate";

const emptyTypeScores = (): TypeScores => ({ win: 0, connect: 0, analyze: 0, axis: 0 });

function answerMap(answers: AnswerRecord[]): Map<string, AnswerRecord> {
  const ids = answers.map((answer) => answer.questionId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate AnswerRecord questionId");
  return new Map(answers.map((answer) => [answer.questionId, answer]));
}

function numericAnswer(answer: AnswerRecord | undefined): number {
  if (!answer || answer.numericValue == null) throw new Error(`Numeric answer is missing: ${answer?.questionId ?? "unknown"}`);
  if (Number(answer.optionId) !== answer.numericValue) throw new Error(`Likert answer mismatch: ${answer.questionId}; optionId=${answer.optionId}; numericValue=${answer.numericValue}`);
  if (answer.numericValue < 1 || answer.numericValue > 5) throw new Error(`Likert answer out of range: ${answer.questionId}`);
  return answer.numericValue;
}

export function scoreBaseTypes(questions: QuestionDefinition[], answers: AnswerRecord[]): TypeScores {
  validateAnswerRecords(questions, answers);
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

const samePair = (left: [TypeId, TypeId], right: [TypeId, TypeId]): boolean => [...left].sort().join("|") === [...right].sort().join("|");

export function aggregateComparison(questions: QuestionDefinition[], input: ComparisonInput): ComparisonResolution {
  const { expectedPair: pair, answers, phase, initialQuestionIds, additionalQuestionIds } = input;
  if (answers.length > 4) throw new Error("Comparison accepts at most four answers");
  if (!initialQuestionIds[0].endsWith("-1") || !initialQuestionIds[1].endsWith("-2")) throw new Error("Initial comparison questions must be -1 and -2");
  if (!additionalQuestionIds[0].endsWith("-3") || !additionalQuestionIds[1].endsWith("-4")) throw new Error("Additional comparison questions must be -3 and -4");
  const configuredIds = [...initialQuestionIds, ...additionalQuestionIds];
  if (new Set(configuredIds).size !== 4) throw new Error("Comparison question ids must be unique");
  const counts = emptyTypeScores();
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  if (configuredIds.some((questionId) => !questionMap.has(questionId))) throw new Error("Comparison question id is outside the configured questions");
  for (const questionId of configuredIds) {
    const mappedTypes = questionMap.get(questionId)!.options.map((option) => option.typeId).filter((value): value is TypeId => Boolean(value));
    if (mappedTypes.length !== 2 || !samePair(pair, [mappedTypes[0], mappedTypes[1]])) throw new Error(`Comparison question is outside expected pair: ${questionId}`);
  }
  for (const answer of answers) if (!configuredIds.includes(answer.questionId)) throw new Error(`Question is not part of comparison pair: ${answer.questionId}`);
  validateAnswerRecords(questions, answers);
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
  const answerIds = answers.map((answer) => answer.questionId);
  const expectedInitialPrefix = initialQuestionIds.slice(0, answers.length);
  const initialCounts = rawAnswers.slice(0, 2).reduce((result, item) => ({ ...result, [item.selectedType]: result[item.selectedType] + 1 }), emptyTypeScores());
  if (phase === "initial") {
    if (answers.length > 2 || answerIds.some((id, index) => id !== expectedInitialPrefix[index])) throw new Error("Initial comparison accepts only -1/-2 in order");
  } else if (phase === "additional") {
    if (answers.length < 2 || answerIds[0] !== initialQuestionIds[0] || answerIds[1] !== initialQuestionIds[1]) throw new Error("Additional comparison requires both initial answers");
    if (!pair.every((typeId) => initialCounts[typeId] === 1)) throw new Error("Additional comparison is allowed only after an initial 1-1 result; initial 2-0 is completed");
    const expectedOrder = [...initialQuestionIds, ...additionalQuestionIds].slice(0, answers.length);
    if (answerIds.some((id, index) => id !== expectedOrder[index])) throw new Error("Additional comparison question order is invalid");
  } else {
    if (answers.length !== 2 && answers.length !== 4) throw new Error("Completed comparison requires exactly two or four answers");
    const expectedOrder = [...initialQuestionIds, ...additionalQuestionIds].slice(0, answers.length);
    if (answerIds.some((id, index) => id !== expectedOrder[index])) throw new Error("Completed comparison question order is invalid");
    if (answers.length === 2 && !pair.some((typeId) => initialCounts[typeId] === 2)) throw new Error("Two-answer completed comparison requires an initial 2-0 result");
    if (answers.length === 4 && !pair.every((typeId) => initialCounts[typeId] === 1)) throw new Error("Four-answer completed comparison requires an initial 1-1 result");
  }
  const base = { pair, initialQuestionIds, additionalQuestionIds, counts, rawAnswers };
  if (phase === "initial" && answers.length < 2) return { ...base, status: "needs_more", phase: "initial", nextQuestionIds: initialQuestionIds.slice(answers.length) };
  if (phase === "initial" && answers.length === 2) {
    const winner = pair.find((typeId) => counts[typeId] === 2);
    if (winner) return { ...base, status: "resolved", phase: "completed", winner, nextQuestionIds: [] };
    return { ...base, status: "needs_more", phase: "additional", nextQuestionIds: [...additionalQuestionIds] };
  }
  if (phase === "completed" && answers.length === 2) {
    const winner = pair.find((typeId) => counts[typeId] === 2)!;
    return { ...base, status: "resolved", phase: "completed", winner, nextQuestionIds: [] };
  }
  if (answers.length < 4) return { ...base, status: "needs_more", phase: "additional", nextQuestionIds: additionalQuestionIds.slice(answers.length - 2) };
  const winner = pair.find((typeId) => counts[typeId] >= 3);
  return winner
    ? { ...base, status: "resolved", phase: "completed", winner, nextQuestionIds: [] }
    : { ...base, status: "low_confidence", phase: "completed", nextQuestionIds: [] };
}

export function resolveType(base: TypeScores, comparison?: ComparisonResolution): TypeResolution {
  const ranked = rankedTypes(base);
  const [first, second, third] = ranked;
  if (comparison && !samePair(comparison.pair, [first[0], second[0]])) throw new Error("Comparison pair must match the base top two types");
  if (first[1] <= THRESHOLDS.type.flatTopMax || first[1] - third[1] <= THRESHOLDS.type.clusterTopToThirdMax) {
    return { kind: "low-confidence", candidates: [first[0], second[0], third[0]] };
  }
  if (first[1] - second[1] >= THRESHOLDS.type.clearMarginMin) {
    const secondary = second[1] >= THRESHOLDS.type.secondaryDisplayMin && second[1] > third[1] ? second[0] : undefined;
    return secondary
      ? { kind: "resolved", primary: first[0], secondary, source: "base" }
      : { kind: "resolved", primary: first[0], source: "base" };
  }
  const resolution = comparison?.status === "resolved" ? comparison.winner : undefined;
  if (resolution) {
    const secondary = resolution === first[0] ? second[0] : first[0];
    return { kind: "resolved", primary: resolution, secondary, source: "comparison" };
  }
  return { kind: "low-confidence", candidates: [first[0], second[0]] };
}

export interface ExpressionScoringOptions {
  confirmationActivated?: boolean;
  confirmationSkipped?: boolean;
  confirmationAnswered?: boolean;
  confirmationQuestionIds?: [string, string];
}

export function scoreExpression(questions: QuestionDefinition[], answers: AnswerRecord[], isGeneric: boolean, options: ExpressionScoringOptions = {}): ExpressionResult {
  if (options.confirmationActivated && options.confirmationSkipped) throw new Error("Invalid expression confirmation options: cannot activate and skip confirmation");
  if (options.confirmationAnswered && !options.confirmationQuestionIds) throw new Error("confirmationQuestionIds are required when confirmationAnswered=true");
  validateAnswerRecords(questions, answers);
  const map = answerMap(answers);
  const items = questions.filter((q) => (isGeneric ? q.block === "generic-expression" : q.block === "expression") && q.metric === "expression" && !q.isConfirmation && (q.polarity === "positive" || q.polarity === "negative"));
  const values = items.map((q) => {
    const value = numericAnswer(map.get(q.id));
    return q.polarity === "negative" ? 6 - value : value;
  });
  if (values.length < 3) throw new Error("Expression scoring requires at least three scored items");
  const rawScore = values.reduce((sum, value) => sum + value, 0);
  const switchItems = questions.filter((q) => (isGeneric ? q.block === "generic-expression" : q.block === "expression") && q.polarity === "switch" && (isGeneric || !q.isConfirmation || options.confirmationActivated));
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
      confirmationStatus = options.confirmationSkipped ? "skipped" : switchScore == null ? "pending" : "unresolved";
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
  confirmationAnswered?: boolean;
  confirmationQuestionIds?: [string, string];
}

export function scoreGap(questions: QuestionDefinition[], answers: AnswerRecord[], options: GapScoringOptions = {}): GapResult {
  if (options.includeConfirmation && options.confirmationSkipped) throw new Error("Invalid gap confirmation options: cannot set both includeConfirmation and confirmationSkipped");
  if (options.confirmationAnswered && !options.confirmationQuestionIds) throw new Error("confirmationQuestionIds are required when confirmationAnswered=true");
  validateAnswerRecords(questions, answers);
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
  validateAnswerRecords(questions, answers);
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
  validateAnswerRecords(questions, answers);
  return utilizationContradictions(questions, answers).length > 0;
}

export interface UtilizationScoringOptions {
  confirmationRequested?: boolean;
  confirmationSkipped?: boolean;
  confirmationAnswered?: boolean;
  confirmationQuestionIds?: [string, string];
}

export function scoreUtilization(questions: QuestionDefinition[], answers: AnswerRecord[], options: UtilizationScoringOptions = {}): UtilizationResult {
  if (options.confirmationRequested && options.confirmationSkipped) throw new Error("Invalid utilization confirmation options: cannot set both confirmationRequested and confirmationSkipped");
  if (options.confirmationAnswered && !options.confirmationQuestionIds) throw new Error("confirmationQuestionIds are required when confirmationAnswered=true");
  validateAnswerRecords(questions, answers);
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
  validateAnswerRecords(questions, answers);
  const durations = answers.map((a) => a.durationMs).filter((n): n is number => Number.isFinite(n) && n! >= 0);
  const fastResponse = durations.length > 0 && median(durations) < THRESHOLDS.reliability.medianFastResponseMs;
  let maxPositionRun = 0, currentPositionRun = 0, lastPosition: number | undefined, currentPositionIds: string[] = [], maxPositionIds: string[] = [];
  for (const answer of answers) {
    if (answer.displayedPosition != null && answer.displayedPosition === lastPosition) { currentPositionRun += 1; currentPositionIds.push(answer.questionId); }
    else { currentPositionRun = 1; currentPositionIds = [answer.questionId]; }
    lastPosition = answer.displayedPosition;
    if (currentPositionRun > maxPositionRun) { maxPositionRun = currentPositionRun; maxPositionIds = [...currentPositionIds]; }
  }
  const likertAnswers = answers.filter((a) => a.numericValue != null);
  let maxLikertRun = 0, currentLikertRun = 0, lastLikert: number | undefined, currentLikertIds: string[] = [], maxLikertIds: string[] = [];
  for (const answer of likertAnswers) {
    if (answer.numericValue === lastLikert) { currentLikertRun += 1; currentLikertIds.push(answer.questionId); }
    else { currentLikertRun = 1; currentLikertIds = [answer.questionId]; }
    lastLikert = answer.numericValue;
    if (currentLikertRun > maxLikertRun) { maxLikertRun = currentLikertRun; maxLikertIds = [...currentLikertIds]; }
  }
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  let maxSemanticRun = 0, currentSemanticRun = 0, lastSemantic: string | undefined, currentSemanticIds: string[] = [], maxSemanticIds: string[] = [];
  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    const option = question?.options.find((item) => item.id === answer.optionId);
    const semantic = option?.typeId ? `type:${option.typeId}` : option?.defenseCategory ? `defense:${option.defenseCategory}` : undefined;
    if (semantic && semantic === lastSemantic) { currentSemanticRun += 1; currentSemanticIds.push(answer.questionId); }
    else { currentSemanticRun = semantic ? 1 : 0; currentSemanticIds = semantic ? [answer.questionId] : []; }
    lastSemantic = semantic;
    if (currentSemanticRun > maxSemanticRun) { maxSemanticRun = currentSemanticRun; maxSemanticIds = [...currentSemanticIds]; }
  }
  const reverseContradiction = utilizationContradictions(questions, answers).length > 0;
  const map = answerMap(answers);
  const mismatchSourceIds: string[] = [];
  const similarQuestionMismatch = questions.some((confirmation) => {
    if (!confirmation.isConfirmation || confirmation.polarity !== "positive" || (confirmation.metric !== "awareness" && confirmation.metric !== "utilization")) return false;
    const confirmationAnswer = map.get(confirmation.id);
    if (!confirmationAnswer) return false;
    const base = questions.filter((question) => !question.isConfirmation && question.targetType === confirmation.targetType && question.metric === confirmation.metric && question.polarity === "positive" && map.has(question.id));
    if (!base.length) return false;
    const average = base.map((question) => numericAnswer(map.get(question.id))).reduce((sum, value) => sum + value, 0) / base.length;
    const mismatched = Math.abs(numericAnswer(confirmationAnswer) - average) >= 3;
    if (mismatched) mismatchSourceIds.push(confirmation.id, ...base.map((question) => question.id));
    return mismatched;
  });
  const questionBlock = (questionId: string): DiagnosisBlock | undefined => {
    const question = questionMap.get(questionId);
    if (!question) return undefined;
    if (question.block === "common-type" || question.block === "type-comparison") return "type";
    if (question.block === "expression" || question.block === "generic-expression") return "expression";
    if (question.block.includes("gap")) return "gap";
    if (question.block === "defense") return "defense";
    if (question.block === "utilization") return "utilization";
    return undefined;
  };
  const blocksFor = (source: AnswerRecord[]): DiagnosisBlock[] => [...new Set(source.map((answer) => questionBlock(answer.questionId)).filter((block): block is DiagnosisBlock => Boolean(block)))];
  const blocksForIds = (sourceIds: string[]): DiagnosisBlock[] => [...new Set(sourceIds.map((questionId) => questionBlock(questionId)).filter((block): block is DiagnosisBlock => Boolean(block)))];
  const issues: ReliabilityIssue[] = [];
  if (fastResponse) issues.push({ flag: "fastResponse", affectedBlocks: blocksFor(answers.filter((answer) => Number.isFinite(answer.durationMs))), severity: "major", sourceQuestionIds: answers.filter((answer) => Number.isFinite(answer.durationMs)).map((answer) => answer.questionId) });
  if (maxPositionRun >= THRESHOLDS.reliability.positionRunLength) issues.push({ flag: "positionStreak", affectedBlocks: blocksForIds(maxPositionIds), severity: "info", sourceQuestionIds: maxPositionIds });
  if (maxSemanticRun >= THRESHOLDS.reliability.positionRunLength) issues.push({ flag: "semanticMonotony", affectedBlocks: blocksForIds(maxSemanticIds), severity: "major", sourceQuestionIds: maxSemanticIds });
  if (maxLikertRun >= THRESHOLDS.reliability.likertRunLength) issues.push({ flag: "likertSameValueStreak", affectedBlocks: blocksForIds(maxLikertIds), severity: "major", sourceQuestionIds: maxLikertIds });
  if (reverseContradiction) issues.push({ flag: "reverseContradiction", affectedBlocks: ["utilization"], severity: "major", sourceQuestionIds: answers.filter((answer) => questionBlock(answer.questionId) === "utilization").map((answer) => answer.questionId) });
  if (similarQuestionMismatch) issues.push({ flag: "similarQuestionMismatch", affectedBlocks: blocksForIds(mismatchSourceIds), severity: "major", sourceQuestionIds: [...new Set(mismatchSourceIds)] });
  return {
    fastResponse,
    positionStreak: maxPositionRun >= THRESHOLDS.reliability.positionRunLength,
    semanticMonotony: maxSemanticRun >= THRESHOLDS.reliability.positionRunLength,
    likertSameValueStreak: maxLikertRun >= THRESHOLDS.reliability.likertRunLength,
    reverseContradiction,
    similarQuestionMismatch,
    issues,
  };
}

export function reliabilityAssessment(flags: ReliabilityFlags): ReliabilityAssessment {
  const mainSignalCount = [flags.fastResponse, flags.semanticMonotony, flags.likertSameValueStreak, flags.reverseContradiction, flags.similarQuestionMismatch].filter(Boolean).length;
  const weakenedBlocks = (["type", "expression", "gap", "defense", "utilization"] as const).filter((block) => new Set(flags.issues.filter((issue) => issue.severity === "major" && issue.affectedBlocks.includes(block)).map((issue) => issue.flag)).size >= 2);
  return {
    mainSignalCount,
    overallWeakening: weakenedBlocks.length > 0,
    blockContradictions: [
      ...(flags.reverseContradiction ? ["reverseContradiction" as const] : []),
      ...(flags.similarQuestionMismatch ? ["similarQuestionMismatch" as const] : []),
    ],
    weakenedBlocks,
  };
}

export function applyReliabilityToConfidences(confidences: BlockConfidences, issues: ReliabilityIssue[]): BlockConfidences {
  const next = { ...confidences };
  for (const block of ["type", "expression", "gap", "defense", "utilization"] as const) {
    const majorFlags = new Set(issues.filter((issue) => issue.severity === "major" && issue.affectedBlocks.includes(block)).map((issue) => issue.flag));
    if (majorFlags.size >= 2) next[block] = "low";
  }
  return next;
}

export function classifyResultVersion(metadata: ResultMetadata): "current" | "read-only" {
  if (!metadata.reportTemplateVersion?.trim()) throw new Error("reportTemplateVersion is required");
  return metadata.questionBankVersion === QUESTION_BANK_VERSION && metadata.scoringVersion === SCORING_VERSION && metadata.engineVersion === ENGINE_VERSION && metadata.reportTemplateVersion === REPORT_TEMPLATE_VERSION ? "current" : "read-only";
}

export function evaluateTypeFit(signals: TypeFitResult["signals"]): TypeFitResult {
  return { incompatible: signals.fitItemLow && Boolean(signals.baseMarginSmall || signals.secondFitSignalLow || signals.blockInconsistency), signals };
}

export function deriveTypeFitSignals(questions: QuestionDefinition[], answers: AnswerRecord[], baseScores: TypeScores, targetType: TypeId): TypeFitResult["signals"] {
  validateAnswerRecords(questions, answers);
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
  routingState: DiagnosisRoute;
  expressionIsGeneric: boolean;
  typeFitSignals?: TypeFitResult["signals"];
}): DiagnosisResult {
  const state = args.routingState;
  const metadata: ResultMetadata = { questionBankVersion: state.questionBankVersion, scoringVersion: state.scoringVersion, engineVersion: state.engineVersion, reportTemplateVersion: state.reportTemplateVersion };
  if (classifyResultVersion(metadata) !== "current") throw new Error("Historical version results are read-only and cannot be recalculated");
  if (state.route === "pending-comparison") throw new Error("Cannot build a final DiagnosisResult while comparison is pending");
  validateAnswerRecords(args.questions, args.answers);
  const answeredIds = new Set(args.answers.map((answer) => answer.questionId));
  const missingQuestionIds = state.questionIds.filter((questionId) => !answeredIds.has(questionId));
  if (missingQuestionIds.length) throw new Error(`Final result requires all planned answers: ${missingQuestionIds.join(",")}`);
  const baseTypeScores = scoreBaseTypes(args.questions, args.answers);
  const computedResolution = resolveType(baseTypeScores, state.comparison);
  if (state.route === "low-confidence" && state.typeResolution.kind !== "low-confidence") throw new Error("low-confidence route requires a low-confidence typeResolution");
  if (state.route === "resolved" && state.typeResolution.kind !== "resolved") throw new Error("resolved route requires a resolved typeResolution");
  if (!(state.routeLocked && state.route === "low-confidence") && JSON.stringify(computedResolution) !== JSON.stringify(state.typeResolution)) throw new Error("Routing typeResolution does not match the computed result");
  const resolution = state.routeLocked && state.route === "low-confidence" ? state.typeResolution : computedResolution;
  const confirmationIds = (kind: "expression" | "gap" | "utilization"): [string, string] | undefined => {
    const matches = args.questions.filter((question) => {
      if (!question.isConfirmation) return false;
      if (kind === "expression") return question.metric === "expression";
      if (kind === "gap") return question.metric === "gap";
      return question.block === "utilization";
    }).map((question) => question.id);
    return matches.length === 2 ? [matches[0], matches[1]] : undefined;
  };
  const confirmationState = (kind: "expression" | "gap" | "utilization") => {
    const activated = state.activatedConfirmations.includes(kind);
    const skipped = state.skippedConfirmations.includes(kind) || state.confirmationSkipReasons[kind] === "budget_exceeded";
    const ids = confirmationIds(kind);
    if (activated && !ids) throw new Error(`${kind} confirmation is activated but confirmationQuestionIds are missing`);
    if (activated && ids && !ids.every((questionId) => answeredIds.has(questionId))) throw new Error(`${kind} confirmation is activated but not fully answered`);
    return { activated, skipped, ids, answered: Boolean(activated && ids?.every((questionId) => answeredIds.has(questionId))) };
  };
  const expressionConfirmation = confirmationState("expression");
  const gapConfirmation = confirmationState("gap");
  const utilizationConfirmation = confirmationState("utilization");
  const baseExpression = scoreExpression(args.questions, args.answers, args.expressionIsGeneric);
  const baseGap = scoreGap(args.questions, args.answers);
  const utilizationNeedsConfirmation = needsUtilizationConfirmation(args.questions, args.answers);
  if (expressionConfirmation.activated && !baseExpression.requiresConfirmation) throw new Error("Expression confirmation requires an expression mid-band result");
  if (gapConfirmation.activated && baseGap.pattern !== "unclear") throw new Error("Gap confirmation requires an unclear gap direction");
  if (utilizationConfirmation.activated && !utilizationNeedsConfirmation) throw new Error("Utilization confirmation requires a contradiction");
  const expression = scoreExpression(args.questions, args.answers, args.expressionIsGeneric, { confirmationActivated: expressionConfirmation.activated, confirmationSkipped: expressionConfirmation.skipped, confirmationAnswered: expressionConfirmation.answered, confirmationQuestionIds: expressionConfirmation.ids });
  const gap = scoreGap(args.questions, args.answers, { includeConfirmation: gapConfirmation.activated, confirmationSkipped: gapConfirmation.skipped, confirmationAnswered: gapConfirmation.answered, confirmationQuestionIds: gapConfirmation.ids });
  const defense = scoreDefense(args.questions, args.answers);
  const utilization = scoreUtilization(args.questions, args.answers, { confirmationRequested: utilizationConfirmation.activated, confirmationSkipped: utilizationConfirmation.skipped, confirmationAnswered: utilizationConfirmation.answered, confirmationQuestionIds: utilizationConfirmation.ids });
  const reliability = detectReliability(args.questions, args.answers);
  const fitTarget = resolution.kind === "resolved" ? resolution.primary : resolution.candidates[0];
  const typeFit = evaluateTypeFit(args.typeFitSignals ?? deriveTypeFitSignals(args.questions, args.answers, baseTypeScores, fitTarget));
  let typeConfidence: Confidence;
  if (resolution.kind === "low-confidence" || typeFit.incompatible) typeConfidence = "low";
  else if (resolution.source === "comparison") typeConfidence = "medium";
  else typeConfidence = "high";
  const confidence = applyReliabilityToConfidences({ type: typeConfidence, expression: expression.confidence, gap: gap.confidence, defense: defense.confidence, utilization: utilization.confidence }, reliability.issues);
  return {
    engineVersion: state.engineVersion,
    scoringVersion: state.scoringVersion,
    questionBankVersion: state.questionBankVersion,
    reportTemplateVersion: state.reportTemplateVersion,
    metadata,
    resolution,
    baseTypeScores,
    comparison: state.comparison,
    expression,
    gap,
    defense,
    utilization,
    typeFit,
    reliability,
    confidence,
    route: state.route,
    answeredQuestionIds: args.answers.map((answer) => answer.questionId),
  };
}
