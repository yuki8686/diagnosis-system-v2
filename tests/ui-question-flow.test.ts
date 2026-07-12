import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { comparisonAnswersForPair, resolveCommon, scoreComparison } from "../src/ui/engine";
import { firstUnansweredQuestionId, nextUnansweredQuestionId, questionNavigationKey, unansweredQuestionIds } from "../src/ui/question-state";
import { activeSessionAnswers, invalidateDerivedState, newSession, questionHistoryEntry, restorePreviousQuestionHistory, upsertAnswer } from "../src/ui/session";
import type { AnswerRecord, QuestionDefinition, TypeId } from "../src/types";

const questionById = new Map(Object.values(questionBank.comparisons).flat().map((question) => [question.id, question]));
const answerFor = (questionId: string, typeId: TypeId): AnswerRecord => {
  const question = questionById.get(questionId)!;
  const option = question.options.find((candidate) => candidate.typeId === typeId)!;
  return { questionId, questionVersion: question.version, optionId: option.id, answeredAt: "2026-07-12T00:00:00.000Z", durationMs: 1000 };
};

const pair: [TypeId, TypeId] = ["win", "connect"];
const commonAnswer: AnswerRecord = { questionId: "C01", questionVersion: 1, optionId: questionBank.commonType[0].options[0].id, answeredAt: "2026-07-12T00:00:00.000Z", durationMs: 1000 };
const initial = [answerFor("VS-WC-1", "win"), answerFor("VS-WC-2", "connect")];

const initialOnly = comparisonAnswersForPair(pair, [commonAnswer, ...initial], "initial");
assert.deepEqual(initialOnly.map((answer) => answer.questionId), ["VS-WC-1", "VS-WC-2"], "common answers are excluded from initial comparison input");
assert.doesNotThrow(() => resolveCommon([commonAnswer, ...initial]), "comparison answers are excluded before common-type scoring");
const initialResult = scoreComparison(pair, initialOnly, "initial");
assert.equal(initialResult.status, "needs_more");
assert.deepEqual(initialResult.nextQuestionIds, ["VS-WC-3", "VS-WC-4"], "initial 1-1 asks only the ordered additional pair");

const unorderedStoredAnswers = [commonAnswer, ...initial, answerFor("VS-WC-4", "win"), answerFor("VS-WC-3", "win")];
const additional = comparisonAnswersForPair(pair, unorderedStoredAnswers, "additional");
assert.deepEqual(additional.map((answer) => answer.questionId), ["VS-WC-1", "VS-WC-2", "VS-WC-3", "VS-WC-4"], "comparison answers are normalized to question-bank order after an answer is replaced");
const resolved = scoreComparison(pair, additional, "additional");
assert.equal(resolved.status, "resolved", "ordered additional answers resolve without an internal order error");
assert.equal(resolved.status === "resolved" && resolved.winner, "win");

const directResult = scoreComparison(pair, comparisonAnswersForPair(pair, [answerFor("VS-WC-1", "win"), answerFor("VS-WC-2", "win")], "initial"), "initial");
assert.equal(directResult.status, "resolved", "initial 2-0 does not request additional questions");

const questionPage: QuestionDefinition[] = questionBank.commonType.slice(0, 4);
const allMissing = unansweredQuestionIds(questionPage, () => undefined);
assert.deepEqual(allMissing, questionPage.map((question) => question.id), "all four unanswered cards are recorded in display order");
assert.equal(firstUnansweredQuestionId(allMissing), questionPage[0].id, "the first card is targeted when every card is unanswered");
const selected = (questionId: string): string | undefined => questionId === questionPage[0].id || questionId === questionPage[2].id ? "selected" : undefined;
const missing = unansweredQuestionIds(questionPage, selected);
assert.deepEqual(missing, [questionPage[1].id, questionPage[3].id]);
assert.equal(firstUnansweredQuestionId(missing), questionPage[1].id, "the second card is the scroll target when it is the first unanswered card");
assert.deepEqual(unansweredQuestionIds(questionPage, (questionId) => questionId === questionPage[1].id ? "selected" : undefined), [questionPage[0].id, questionPage[2].id, questionPage[3].id]);
assert.deepEqual(unansweredQuestionIds(questionPage, (questionId) => questionId === questionPage[1].id ? undefined : "selected"), [questionPage[1].id], "the second card remains the sole target until it is answered");
assert.equal(nextUnansweredQuestionId(questionPage, questionPage[0].id, () => undefined), questionPage[1].id, "normal answers target the next unanswered card without requiring a validation error");
assert.equal(nextUnansweredQuestionId(questionPage, questionPage[1].id, (questionId) => questionId === questionPage[3].id ? undefined : "selected"), questionPage[3].id, "the next unanswered card is calculated after the current answer");
assert.equal(nextUnansweredQuestionId(questionPage, questionPage[3].id, () => "selected"), undefined, "the final answer does not auto-advance the page");
const comparisonPage = questionBank.comparisons["connect-win"].slice(0, 2);
const likertPage = questionBank.genericExpression.slice(0, 2);
assert.equal(nextUnansweredQuestionId(comparisonPage, comparisonPage[0].id, () => undefined), comparisonPage[1].id, "comparison questions use the same next-question calculation");
assert.equal(nextUnansweredQuestionId(likertPage, likertPage[0].id, () => undefined), likertPage[1].id, "likert questions use the same next-question calculation");
assert.notEqual(questionNavigationKey(0, ["C01", "C02"], "common"), questionNavigationKey(1, ["C01", "C02"], "common"), "page changes produce a new top-scroll key");
assert.notEqual(questionNavigationKey(0, ["VS-WC-1", "VS-WC-2"], "comparison-initial"), questionNavigationKey(0, ["VS-WC-3", "VS-WC-4"], "comparison-additional"), "block changes produce a new top-scroll key");

const baseSession = { ...newSession(), currentQuestionIds: questionBank.commonType.map((question) => question.id), currentPageIndex: 2 };
const commonHistory = questionHistoryEntry(baseSession, "common");
const comparisonSession = { ...baseSession, currentQuestionIds: ["VS-WC-1", "VS-WC-2"], currentPageIndex: 0, questionHistory: [commonHistory], answers: upsertAnswer(initial, initial[0]) };
const comparisonHistory = questionHistoryEntry(comparisonSession, "comparison-initial");
const additionalSession = { ...comparisonSession, currentQuestionIds: ["VS-WC-3", "VS-WC-4"], questionHistory: [commonHistory, comparisonHistory] };
const backToInitial = restorePreviousQuestionHistory(additionalSession)!;
assert.deepEqual(backToInitial.currentQuestionIds, ["VS-WC-1", "VS-WC-2"], "additional comparison returns to the initial pair");
assert.equal(backToInitial.answers.length, 2, "answers survive a block-boundary back action");
const backToCommon = restorePreviousQuestionHistory(backToInitial)!;
assert.deepEqual(backToCommon.currentQuestionIds, questionBank.commonType.map((question) => question.id), "comparison start returns to the final common-question page");
assert.equal(backToCommon.currentPageIndex, 2);

const staleTypeAnswer: AnswerRecord = { questionId: "GE01", questionVersion: 1, optionId: "3", numericValue: 3, answeredAt: "2026-07-12T00:00:00.000Z", durationMs: 1000 };
const staleRouteSession = {
  ...additionalSession,
  answers: [commonAnswer, ...additionalSession.answers, answerFor("VS-WC-3", "win"), answerFor("VS-WC-4", "win"), staleTypeAnswer],
  comparisonResolution: resolved,
  route: { route: "resolved" } as never,
  questionHistory: [commonHistory, comparisonHistory, questionHistoryEntry({ ...additionalSession, route: { route: "resolved" } as never }, "type-route")],
};
const resetFromInitialComparison = invalidateDerivedState(staleRouteSession, [...questionBank.commonType.map((question) => question.id), "VS-WC-1", "VS-WC-2"], "comparison-initial", true);
assert.equal(resetFromInitialComparison.comparisonResolution, undefined, "changing an initial comparison answer invalidates the old comparison result");
assert.equal(resetFromInitialComparison.route, undefined, "changing an initial comparison answer invalidates the old route");
assert.deepEqual(resetFromInitialComparison.questionHistory?.map((entry) => entry.stage), ["common"], "downstream comparison and route history is discarded");
assert.deepEqual(activeSessionAnswers(resetFromInitialComparison).map((answer) => answer.questionId).sort(), ["C01", "VS-WC-1", "VS-WC-2"].sort(), "old additional and type-specific answers remain stored but are excluded from the new branch");
const resetFromCommon = invalidateDerivedState(staleRouteSession, questionBank.commonType.map((question) => question.id), "common", false);
assert.equal(resetFromCommon.typeResolution, undefined, "changing a common answer invalidates the old type resolution");
assert.equal(resetFromCommon.comparisonResolution, undefined, "changing a common answer invalidates the old comparison result");
assert.equal(resetFromCommon.route, undefined, "changing a common answer invalidates the old route");
assert.deepEqual(resetFromCommon.questionHistory, [], "changing a common answer removes all derived history");
assert.deepEqual(activeSessionAnswers(resetFromCommon).map((answer) => answer.questionId), ["C01"], "old comparison and type-specific answers are excluded after a common-answer change");

console.log("UI comparison ordering, unanswered state, and cross-block history tests passed");
