import { questionBank } from "../data/question-bank";
import { flattenQuestionBank } from "../data/question-bank-contract";
import { buildDiagnosisRoute } from "../routing";
import { aggregateComparison, buildDiagnosisResult, resolveType, scoreBaseTypes } from "../scoring";
import { generateFreeReport } from "../report";
import type { AnswerRecord, ComparisonResolution, DiagnosisRoute, QuestionDefinition, TypeId, TypeResolution } from "../types";
import type { DiagnosisSession } from "./session";

const allQuestions = flattenQuestionBank(questionBank);
const byId = new Map(allQuestions.map((question) => [question.id, question]));
export const commonQuestions = questionBank.commonType;
export const questionsForIds = (ids: string[]): QuestionDefinition[] => ids.map((id) => { const question = byId.get(id); if (!question) throw new Error(`Unknown question: ${id}`); return question; });

const samePair = (question: QuestionDefinition, pair: [TypeId, TypeId]) => pair.every((type) => question.options.some((option) => option.typeId === type));
export function comparisonQuestions(pair: [TypeId, TypeId]): QuestionDefinition[] {
  const found = Object.values(questionBank.comparisons).find((questions) => questions.length === 4 && questions.every((question) => samePair(question, pair)));
  if (!found) throw new Error(`Comparison questions not found: ${pair.join("/")}`);
  return found;
}

export function resolveCommon(answers: AnswerRecord[]): { scores: ReturnType<typeof scoreBaseTypes>; resolution: TypeResolution } {
  const scores = scoreBaseTypes(commonQuestions, answers);
  return { scores, resolution: resolveType(scores) };
}

export function scoreComparison(pair: [TypeId, TypeId], answers: AnswerRecord[], phase: "initial" | "additional"): ComparisonResolution {
  const questions = comparisonQuestions(pair);
  return aggregateComparison(questions, { expectedPair: pair, initialQuestionIds: [questions[0].id, questions[1].id], additionalQuestionIds: [questions[2].id, questions[3].id], answers: answers.filter((answer) => questions.some((q) => q.id === answer.questionId)), phase });
}

export function buildRoute(session: DiagnosisSession, resolution: TypeResolution, comparison?: ComparisonResolution, previousState?: DiagnosisRoute, confirmationNeeds: { expression?: boolean; gap?: boolean; utilization?: boolean } = {}): DiagnosisRoute {
  return buildDiagnosisRoute({ sessionId: session.sessionId, sessionSeed: session.sessionSeed, resolution, comparison, confirmationNeeds, answeredQuestionIds: session.answers.map((answer) => answer.questionId), previousState, transitionSequence: (previousState?.transitionHistory.at(-1)?.sequence ?? 0) + 1 });
}

export function finishDiagnosis(session: DiagnosisSession): DiagnosisSession {
  if (!session.route) throw new Error("Diagnosis route is missing");
  const questions = questionsForIds(session.route.questionIds);
  const result = buildDiagnosisResult({ questions, answers: session.answers, routingState: session.route, expressionIsGeneric: session.route.route === "low-confidence" });
  const needs = { expression: result.expression.requiresConfirmation, gap: result.gap.pattern === "unclear", utilization: result.utilization.requiresConfirmation };
  const expanded = buildRoute(session, session.route.typeResolution, session.route.comparison, session.route, needs);
  const unanswered = expanded.questionIds.filter((id) => !session.answers.some((answer) => answer.questionId === id));
  if (unanswered.length) return { ...session, route: expanded, currentQuestionIds: unanswered, currentPageIndex: 0 };
  const finalQuestions = questionsForIds(expanded.questionIds);
  const finalResult = buildDiagnosisResult({ questions: finalQuestions, answers: session.answers, routingState: expanded, expressionIsGeneric: expanded.route === "low-confidence" });
  const freeReport = generateFreeReport({ result: finalResult, route: expanded, answers: session.answers, questions: finalQuestions });
  return { ...session, route: expanded, freeReport, currentQuestionIds: [], currentPageIndex: 0 };
}
