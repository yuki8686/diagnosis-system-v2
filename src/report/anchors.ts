import type { AnswerRecord, AnswerReference, PersonalizationAnchor, QuestionDefinition, ReportInput } from "../types";

export function buildAnswerReferences(answers: AnswerRecord[], questions: QuestionDefinition[]): AnswerReference[] {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  return answers.map((answer) => {
    if (seen.has(answer.questionId)) throw new Error(`Duplicate report answer: ${answer.questionId}`);
    seen.add(answer.questionId);
    const question = questionMap.get(answer.questionId);
    if (!question) throw new Error(`Report answer question is missing: ${answer.questionId}`);
    if (answer.questionVersion !== question.version) throw new Error(`Report answer version mismatch: ${answer.questionId}; answerVersion=${answer.questionVersion}; expectedVersion=${question.version}`);
    const option = question.options.find((candidate) => candidate.id === answer.optionId);
    if (!option) throw new Error(`Report answer option is invalid: ${answer.questionId}/${answer.optionId}`);
    return {
      questionId: answer.questionId,
      questionVersion: answer.questionVersion,
      prompt: question.prompt,
      selectedOptionId: answer.optionId,
      selectedOptionText: option.label,
      numericValue: answer.numericValue,
      metric: question.metric,
      scenario: question.pairId,
    };
  });
}

export function buildAnchors(input: ReportInput): PersonalizationAnchor[] {
  const result = input.result;
  const anchors: PersonalizationAnchor[] = [];
  if (result.gap.maxGapPair) anchors.push({
    id: `gap-${result.gap.maxGapPair.pairId}`,
    kind: "gap_pair",
    sourceQuestionIds: [result.gap.maxGapPair.innerQuestionId, result.gap.maxGapPair.publicQuestionId],
    summary: `${result.gap.maxGapPair.pairId}で本音側と対人側に${result.gap.maxGapPair.diff}点の差`,
    confidence: result.confidence.gap,
  });
  for (const reaction of result.defense.observedReactions) anchors.push({
    id: `reaction-${reaction.questionId}`,
    kind: "observed_reaction",
    sourceQuestionIds: [reaction.questionId],
    summary: `今回の場面回答で${reaction.category}を選択`,
    confidence: result.confidence.defense,
    opportunityLimited: result.defense.opportunityLimited.includes(reaction.category),
  });
  if (result.utilization.usedQuestionIds.length) anchors.push({
    id: "utilization-gap",
    kind: "utilization",
    sourceQuestionIds: result.utilization.usedQuestionIds,
    summary: `気づき${result.utilization.awareness.toFixed(1)}、活用${result.utilization.utilization.toFixed(1)}`,
    confidence: result.confidence.utilization,
  });
  const typeQuestionIds = input.questions.filter((question) => question.block === "common-type" || question.block === "type-comparison").map((question) => question.id).filter((id) => input.answers.some((answer) => answer.questionId === id));
  if (typeQuestionIds.length) anchors.push({ id: "type-answer", kind: input.questions.some((q) => q.id === typeQuestionIds[0] && q.block === "type-comparison") ? "comparison" : "answer", sourceQuestionIds: [typeQuestionIds[0]], summary: "タイプ判定に使った実回答", confidence: result.confidence.type });
  const confirmationIds = input.route.activatedConfirmations.flatMap((kind) => {
    if (kind === "expression") return result.expression.usedQuestionIds.filter((id) => input.questions.find((q) => q.id === id)?.isConfirmation);
    if (kind === "gap") return result.gap.usedQuestionIds.filter((id) => input.questions.find((q) => q.id === id)?.isConfirmation);
    return result.utilization.usedQuestionIds.filter((id) => input.questions.find((q) => q.id === id)?.isConfirmation);
  });
  if (confirmationIds.length) anchors.push({ id: "confirmation", kind: "confirmation", sourceQuestionIds: [...new Set(confirmationIds)], summary: "最終判定へ反映した確認回答", confidence: "medium" });
  return anchors;
}
