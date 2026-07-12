import type { QuestionDefinition } from "../types";

export function unansweredQuestionIds(page: QuestionDefinition[], selectedOptionId: (questionId: string) => string | undefined): string[] {
  return page.filter((question) => !selectedOptionId(question.id)).map((question) => question.id);
}

export function firstUnansweredQuestionId(questionIds: string[]): string | undefined {
  return questionIds[0];
}

export function nextUnansweredQuestionId(page: QuestionDefinition[], currentQuestionId: string, selectedOptionId: (questionId: string) => string | undefined): string | undefined {
  const currentIndex = page.findIndex((question) => question.id === currentQuestionId);
  return page.slice(currentIndex + 1).find((question) => !selectedOptionId(question.id))?.id;
}

export function questionNavigationKey(pageIndex: number, questionIds: string[], stage: string): string {
  return `${stage}:${pageIndex}:${questionIds.join("|")}`;
}
