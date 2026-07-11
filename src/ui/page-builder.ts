import type { QuestionDefinition } from "../types";

const uiBlock = (question: QuestionDefinition): string => question.block.includes("gap") ? "gap" : question.block === "common-type" ? "common" : question.block === "type-comparison" ? "comparison" : question.block === "generic-expression" ? "expression" : question.block;

export function buildQuestionPages(questions: QuestionDefinition[], maximum = 4): QuestionDefinition[][] {
  if (!Number.isInteger(maximum) || maximum < 1) throw new Error("maximum must be positive");
  const pages: QuestionDefinition[][] = [];
  for (const question of questions) {
    const previous = pages.at(-1);
    if (!previous || uiBlock(previous[0]) !== uiBlock(question) || previous.length >= maximum) pages.push([question]);
    else previous.push(question);
  }
  return pages;
}
