import { DEFENSE_CATEGORIES, TYPE_IDS, type AnswerRecord, type ComparisonScores, type Confidence, type DefenseResult, type DiagnosisResult, type ExpressionResult, type GapPairResult, type GapResult, type QuestionDefinition, type ReliabilityFlags, type TypeFitResult, type TypeId, type TypeResolution, type TypeScores, type UtilizationResult } from "./types";
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

export function resolveType(base: TypeScores, comparisons: ComparisonScores[]): TypeResolution {
  const ranked = rankedTypes(base);
  const [first, second, third] = ranked;
  if (first[1] <= THRESHOLDS.type.flatTopMax || first[1] - third[1] <= THRESHOLDS.type.clusterTopToThirdMax) {
    return { kind: "low-confidence", candidates: [first[0], second[0], third[0]] };
  }
  if (first[1] - second[1] >= THRESHOLDS.type.clearMarginMin) {
    return { kind: "resolved", primary: first[0], secondary: second[1] >= THRESHOLDS.type.secondaryDisplayMin ? second[0] : undefined, source: "base" };
  }
  const relevant = comparisons.find((item) => item.pair.includes(first[0]) && item.pair.includes(second[0]));
  if (relevant?.winner) {
    const secondary = relevant.winner === first[0] ? second[0] : first[0];
    return { kind: "resolved", primary: relevant.winner, secondary, source: "comparison" };
  }
  return { kind: "low-confidence", candidates: [first[0], second[0]] };
}

export function scoreExpression(questions: QuestionDefinition[], answers: AnswerRecord[], isGeneric: boolean): ExpressionResult {
  const map = answerMap(answers);
  const items = questions.filter((q) => (isGeneric ? q.block === "generic-expression" : q.block === "expression") && q.metric === "expression" && !q.isConfirmation);
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
  if (rawScore >= THRESHOLDS.expression.outwardMin) pattern = "outward";
  else if (rawScore <= THRESHOLDS.expression.inwardMax) pattern = "inward";
  else pattern = "adaptive";
  const adaptiveConfirmed = pattern === "adaptive" && switchScore != null && switchScore >= 4;
  return {
    pattern,
    rawScore,
    switchScore,
    confidence: pattern === "adaptive" ? (adaptiveConfirmed ? "medium" : "low") : "high",
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

export function scoreGap(questions: QuestionDefinition[], answers: AnswerRecord[]): GapResult {
  const map = answerMap(answers);
  const pairs = new Map<string, { inner?: QuestionDefinition; public?: QuestionDefinition }>();
  for (const q of questions.filter((item) => item.metric === "gap" && item.pairId && !item.isConfirmation)) {
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
  const maxGapPair = [...results].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  return {
    pattern,
    magnitude,
    directionConsistency: consistency,
    breadth: active,
    strength,
    pairs: results,
    maxGapPair,
    confidence: pattern === "unclear" ? "low" : "high",
    usedQuestionIds: results.flatMap((item) => [item.innerQuestionId, item.publicQuestionId]),
  };
}

export function scoreDefense(questions: QuestionDefinition[], answers: AnswerRecord[]): DefenseResult {
  const map = answerMap(answers);
  const counts = Object.fromEntries(DEFENSE_CATEGORIES.map((id) => [id, 0])) as DefenseResult["counts"];
  const usedQuestionIds: string[] = [];
  for (const q of questions.filter((item) => item.block === "defense")) {
    const answer = map.get(q.id);
    if (!answer) continue;
    const option = q.options.find((item) => item.id === answer.optionId);
    if (!option?.defenseCategory) throw new Error(`Defense mapping missing: ${q.id}/${answer.optionId}`);
    counts[option.defenseCategory] += 1;
    usedQuestionIds.push(q.id);
  }
  const ranked = DEFENSE_CATEGORIES.map((id) => [id, counts[id]] as const).sort((a, b) => b[1] - a[1]);
  const max = ranked[0][1];
  const tied = ranked.filter((item) => item[1] === max && max > 0).map((item) => item[0]);
  let primary: DefenseResult["primary"];
  let secondary: DefenseResult["secondary"];
  let confidence: Confidence = "low";
  if (tied.length === 1 && max >= 3) { primary = tied[0]; confidence = "high"; }
  else if (tied.length === 1 && max === 2) { primary = tied[0]; confidence = "medium"; }
  if (primary) {
    const second = ranked.find((item) => item[0] !== primary && item[1] >= 2);
    secondary = second?.[0];
  }
  return { counts, primary, secondary, tied, confidence, usedQuestionIds };
}

function band(value: number): UtilizationResult["awarenessBand"] {
  return value >= THRESHOLDS.utilization.highMin ? "high" : value >= THRESHOLDS.utilization.middleMin ? "middle" : "growth";
}

export function scoreUtilization(questions: QuestionDefinition[], answers: AnswerRecord[]): UtilizationResult {
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
  return { awareness, utilization, awarenessBand: band(awareness), utilizationBand: band(utilization), gap: awareness - utilization, confidence: "high", usedQuestionIds: relevant.map((q) => q.id) };
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
  return {
    fastResponse,
    positionRun: maxPositionRun >= THRESHOLDS.reliability.positionRunLength,
    semanticMonotony: false,
    likertStraightLine: maxLikertRun >= THRESHOLDS.reliability.likertRunLength,
    reverseContradiction: false,
    similarQuestionMismatch: false,
  };
}

export function evaluateTypeFit(signals: TypeFitResult["signals"]): TypeFitResult {
  return { incompatible: signals.fitItemLow && (signals.baseMarginSmall || signals.secondFitSignalLow), signals };
}

export function buildDiagnosisResult(args: {
  questions: QuestionDefinition[];
  answers: AnswerRecord[];
  comparisons?: ComparisonScores[];
  expressionIsGeneric: boolean;
  typeFitSignals: TypeFitResult["signals"];
}): DiagnosisResult {
  const comparisons = args.comparisons ?? [];
  const baseTypeScores = scoreBaseTypes(args.questions, args.answers);
  const resolution = resolveType(baseTypeScores, comparisons);
  const expression = scoreExpression(args.questions, args.answers, args.expressionIsGeneric);
  const gap = scoreGap(args.questions, args.answers);
  const defense = scoreDefense(args.questions, args.answers);
  const utilization = scoreUtilization(args.questions, args.answers);
  const reliability = detectReliability(args.questions, args.answers);
  const typeFit = evaluateTypeFit(args.typeFitSignals);
  const majorReliability = [reliability.fastResponse, reliability.semanticMonotony, reliability.likertStraightLine, reliability.reverseContradiction, reliability.similarQuestionMismatch].filter(Boolean).length >= 2;
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
