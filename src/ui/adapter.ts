import type { AnswerRecord, ChoiceOption, QuestionDefinition } from "../types";

export function toAnswer(question: QuestionDefinition, option: ChoiceOption, startedAt: number): AnswerRecord {
  const numericValue = question.format === "likert-5" ? Number(option.id) : undefined;
  return { questionId: question.id, questionVersion: question.version, optionId: option.id, ...(numericValue == null ? {} : { numericValue }), answeredAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - startedAt) };
}
