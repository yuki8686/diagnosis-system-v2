import { questionBank } from "../data/question-bank";
import { flattenQuestionBank } from "../data/question-bank-contract";
import { buildDiagnosisRoute } from "../routing";
import { aggregateComparison, buildDiagnosisResult, resolveType, scoreBaseTypes } from "../scoring";
import { generateFreeReport } from "../report";
import type { AnswerRecord, ComparisonResolution, DiagnosisRoute, QuestionDefinition, TypeId, TypeResolution } from "../types";
import { activeSessionAnswers, type DiagnosisSession } from "./session";

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
  const commonQuestionIds = new Set(commonQuestions.map((question) => question.id));
  const scores = scoreBaseTypes(commonQuestions, answers.filter((answer) => commonQuestionIds.has(answer.questionId)));
  return { scores, resolution: resolveType(scores) };
}

/**
 * Derives the next question set immediately after the common 12 questions.
 * A two-candidate low-confidence result is the only path that enters the
 * comparison UI; every other resolution proceeds directly into its route.
 */
export function nextQuestionSetAfterCommon(session: DiagnosisSession): {
  scores: ReturnType<typeof scoreBaseTypes>;
  resolution: TypeResolution;
  route?: DiagnosisRoute;
  currentQuestionIds: string[];
} {
  const answers = activeSessionAnswers(session);
  const { scores, resolution } = resolveCommon(answers);
  if (resolution.kind === "low-confidence" && resolution.candidates.length === 2) {
    const pair = [resolution.candidates[0], resolution.candidates[1]] as [TypeId, TypeId];
    return { scores, resolution, currentQuestionIds: comparisonQuestions(pair).slice(0, 2).map((question) => question.id) };
  }
  const route = buildRoute(session, resolution);
  return { scores, resolution, route, currentQuestionIds: route.questionIds.filter((id) => !answers.some((answer) => answer.questionId === id)) };
}

export function scoreComparison(pair: [TypeId, TypeId], answers: AnswerRecord[], phase: "initial" | "additional"): ComparisonResolution {
  return aggregateComparisonForPair(pair, answers, phase);
}

export function comparisonAnswersForPair(pair: [TypeId, TypeId], answers: AnswerRecord[], phase: "initial" | "additional"): AnswerRecord[] {
  const questions = comparisonQuestions(pair);
  const applicableQuestions = phase === "initial" ? questions.slice(0, 2) : questions;
  const byQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
  return applicableQuestions.flatMap((question) => {
    const answer = byQuestionId.get(question.id);
    return answer ? [answer] : [];
  });
}

function aggregateComparisonForPair(pair: [TypeId, TypeId], answers: AnswerRecord[], phase: "initial" | "additional"): ComparisonResolution {
  const questions = comparisonQuestions(pair);
  const comparisonAnswers = comparisonAnswersForPair(pair, answers, phase);
  return aggregateComparison(questions, { expectedPair: pair, initialQuestionIds: [questions[0].id, questions[1].id], additionalQuestionIds: [questions[2].id, questions[3].id], answers: comparisonAnswers, phase });
}

export function buildRoute(session: DiagnosisSession, resolution: TypeResolution, comparison?: ComparisonResolution, previousState?: DiagnosisRoute, confirmationNeeds: { expression?: boolean; gap?: boolean; utilization?: boolean } = {}): DiagnosisRoute {
  return buildDiagnosisRoute({ sessionId: session.sessionId, sessionSeed: session.sessionSeed, resolution, comparison, confirmationNeeds, answeredQuestionIds: activeSessionAnswers(session).map((answer) => answer.questionId), previousState, transitionSequence: (previousState?.transitionHistory.at(-1)?.sequence ?? 0) + 1 });
}

/**
 * Applies the existing route-level confirmation rules and returns either the
 * next required question set or a route that is ready for result generation.
 * It deliberately does not generate a report, so the UI can present its final
 * confirmation before starting that separate step.
 */
export function prepareDiagnosisCompletion(session: DiagnosisSession): DiagnosisSession {
  if (!session.route) throw new Error("Diagnosis route is missing");
  const activeAnswers = activeSessionAnswers(session);
  const questions = questionsForIds(session.route.questionIds);
  const result = buildDiagnosisResult({ questions, answers: activeAnswers, routingState: session.route, expressionIsGeneric: session.route.route === "low-confidence" });
  const needs = { expression: result.expression.requiresConfirmation, gap: result.gap.pattern === "unclear", utilization: result.utilization.requiresConfirmation };
  const expanded = buildRoute(session, session.route.typeResolution, session.route.comparison, session.route, needs);
  const unanswered = expanded.questionIds.filter((id) => !activeAnswers.some((answer) => answer.questionId === id));
  return { ...session, route: expanded, currentQuestionIds: unanswered, currentPageIndex: 0 };
}

export function finishDiagnosis(session: DiagnosisSession): DiagnosisSession {
  const prepared = prepareDiagnosisCompletion(session);
  if (prepared.currentQuestionIds.length) return prepared;
  const activeAnswers = activeSessionAnswers(prepared);
  const finalQuestions = questionsForIds(prepared.route!.questionIds);
  const finalResult = buildDiagnosisResult({ questions: finalQuestions, answers: activeAnswers, routingState: prepared.route!, expressionIsGeneric: prepared.route!.route === "low-confidence" });
  const freeReport = generateFreeReport({ result: finalResult, route: prepared.route!, answers: activeAnswers, questions: finalQuestions });
  return { ...prepared, freeReport };
}
