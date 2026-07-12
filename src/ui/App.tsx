import { useEffect, useMemo, useRef, useState } from "react";
import { orderQuestionOptions } from "../routing";
import { resolveType } from "../scoring";
import type { ChoiceOption, QuestionDefinition, TypeId } from "../types";
import { toAnswer } from "./adapter";
import { ConfirmationScreen } from "./components/ConfirmationScreen";
import { DiagnosisIntro } from "./components/DiagnosisIntro";
import { FreeResultPage } from "./components/FreeResultPage";
import { LoadingScreen } from "./components/LoadingScreen";
import { QuestionScreen } from "./components/QuestionScreen";
import { RestartConfirmModal } from "./components/RestartConfirmModal";
import { TopPage } from "./components/TopPage";
import { buildRoute, commonQuestions, comparisonAnswersForPair, comparisonQuestions, finishDiagnosis, nextQuestionSetAfterCommon, prepareDiagnosisCompletion, questionsForIds, resolveCommon, scoreComparison } from "./engine";
import { activeUiScreen, hasSavedProgress, initialScreen, nextPageIndex, previousPageIndex, RESULT_LOADING_STEP_MS, RESULT_LOADING_TITLES, shouldScrollWindowToTop, shouldStartResultGeneration, type NormalUiScreen, type UiScreen } from "./flow";
import { buildQuestionPages } from "./page-builder";
import { activeSessionAnswers, invalidateDerivedState, loadSession, newSession, questionHistoryEntry, restorePreviousQuestionHistory, saveSession, STORAGE_KEY, upsertAnswer, type DiagnosisSession } from "./session";
import { completionConfirmationAfterAnswer, nextUnansweredQuestionId, questionNavigationKey, unansweredQuestionIds as findUnansweredQuestionIds } from "./question-state";
import "./styles.css";

const loadedSession = loadSession();
const initialSession = loadedSession.kind === "current" ? loadedSession.session : newSession();

export default function App() {
  const [session, setSession] = useState<DiagnosisSession>(initialSession);
  const [screen, setScreen] = useState<UiScreen>(() => initialScreen(loadedSession));
  const [restartReturnScreen, setRestartReturnScreen] = useState<NormalUiScreen>("top");
  const [error, setError] = useState("");
  const [unansweredQuestionIds, setUnansweredQuestionIds] = useState<string[]>([]);
  const [unansweredFocusRequest, setUnansweredFocusRequest] = useState(0);
  const [focusQuestionId, setFocusQuestionId] = useState<string>();
  const [focusRequest, setFocusRequest] = useState(0);
  const [generationError, setGenerationError] = useState<string>();
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const [generationTitleIndex, setGenerationTitleIndex] = useState(0);
  const startedAt = useRef(Date.now());
  const previousActiveScreen = useRef<NormalUiScreen | undefined>(undefined);
  const generationResultRef = useRef<{ sessionId?: string; finished?: DiagnosisSession }>({});
  const hasSaved = hasSavedProgress(session);
  const questionList = useMemo(() => session.currentQuestionIds.length ? questionsForIds(session.currentQuestionIds) : commonQuestions, [session.currentQuestionIds]);
  const pages = useMemo(() => buildQuestionPages(questionList), [questionList]);
  const pageIndex = Math.min(session.currentPageIndex, Math.max(0, pages.length - 1));
  const page = pages[pageIndex] ?? [];
  const activeScreen = activeUiScreen(screen, restartReturnScreen);
  const activeAnswers = activeSessionAnswers(session);

  useEffect(() => {
    if (shouldScrollWindowToTop(previousActiveScreen.current, activeScreen)) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    previousActiveScreen.current = activeScreen;
  }, [activeScreen]);

  useEffect(() => {
    if (screen !== "generation-pending" || session.freeReport) return;
    if (shouldStartResultGeneration(screen, Boolean(session.freeReport), generationResultRef.current.sessionId, session.sessionId)) {
      try {
        const finished = finishDiagnosis(session);
        if (!finished.freeReport) throw new Error("Result generation did not produce a report");
        generationResultRef.current = { sessionId: session.sessionId, finished };
        setGenerationError(undefined);
      } catch (caught) {
        console.error("Diagnosis result generation failed", caught);
        generationResultRef.current = {};
        setGenerationError("時間をおいて、もう一度お試しください。");
        return;
      }
    }
    const finished = generationResultRef.current.finished;
    if (!finished) return;
    setGenerationTitleIndex(0);
    const secondTitleTimer = window.setTimeout(() => setGenerationTitleIndex(1), RESULT_LOADING_STEP_MS);
    const thirdTitleTimer = window.setTimeout(() => setGenerationTitleIndex(2), RESULT_LOADING_STEP_MS * 2);
    const completeTimer = window.setTimeout(() => {
      commit(finished);
      setScreen("result");
    }, RESULT_LOADING_STEP_MS * RESULT_LOADING_TITLES.length);
    return () => {
      window.clearTimeout(secondTitleTimer);
      window.clearTimeout(thirdTitleTimer);
      window.clearTimeout(completeTimer);
    };
  }, [generationAttempt, screen, session]);

  const commit = (next: DiagnosisSession) => { setSession(next); saveSession(next); };
  const comparisonPhaseFor = (value: DiagnosisSession): "initial" | "additional" => {
    if (value.typeResolution?.kind !== "low-confidence" || value.typeResolution.candidates.length !== 2) return "initial";
    const pair = [value.typeResolution.candidates[0], value.typeResolution.candidates[1]] as [TypeId, TypeId];
    const additionalIds = comparisonQuestions(pair).slice(2).map((question) => question.id);
    return additionalIds.length === value.currentQuestionIds.length && additionalIds.every((questionId, index) => value.currentQuestionIds[index] === questionId) ? "additional" : "initial";
  };
  const stageFor = (value: DiagnosisSession): string => !value.typeResolution ? "common" : !value.route ? `comparison-${comparisonPhaseFor(value)}` : "type-route";
  const moveToQuestionSet = (next: DiagnosisSession, questionIds: string[]): void => {
    const history = [...(session.questionHistory ?? []), questionHistoryEntry(session, stageFor(session))];
    commit({ ...next, currentQuestionIds: questionIds, currentPageIndex: 0, questionHistory: history });
    setFocusQuestionId(undefined);
  };
  const startFresh = () => {
    const next = newSession();
    next.currentQuestionIds = commonQuestions.map((question) => question.id);
    commit(next);
    startedAt.current = Date.now();
    setError("");
    setUnansweredQuestionIds([]);
    setFocusQuestionId(undefined);
    setScreen("questions");
  };
  const requestRestart = (returnScreen: NormalUiScreen) => { setRestartReturnScreen(returnScreen); setScreen("restart-confirm"); };
  const resume = () => { setError(""); setUnansweredQuestionIds([]); setFocusQuestionId(undefined); setScreen(session.freeReport ? "result" : "questions"); };
  const pause = () => { commit(session); setScreen("top"); };
  const answer = (question: QuestionDefinition, option: ChoiceOption) => {
    const previousOptionId = activeSessionAnswers(session).find((answer) => answer.questionId === question.id)?.optionId;
    const answered = { ...session, answers: upsertAnswer(session.answers, toAnswer(question, option, startedAt.current)), invalidatedAnswerQuestionIds: (session.invalidatedAnswerQuestionIds ?? []).filter((questionId) => questionId !== question.id), completionConfirmation: completionConfirmationAfterAnswer(session.completionConfirmation, previousOptionId, option.id) };
    let next: DiagnosisSession = answered;
    if (question.block === "common-type") {
      next = invalidateDerivedState(answered, commonQuestions.map((item) => item.id), "common", false);
    } else if (question.block === "type-comparison" && session.typeResolution?.kind === "low-confidence" && session.typeResolution.candidates.length === 2) {
      const pair = [session.typeResolution.candidates[0], session.typeResolution.candidates[1]] as [TypeId, TypeId];
      const allowedQuestionIds = [...commonQuestions.map((item) => item.id), ...comparisonQuestions(pair).map((item) => item.id)];
      next = invalidateDerivedState(answered, allowedQuestionIds, stageFor(session), true);
    }
    commit(next);
    setUnansweredQuestionIds((ids) => ids.filter((id) => id !== question.id));
    setError("");
    const nextQuestionId = nextUnansweredQuestionId(page, question.id, (questionId) => activeSessionAnswers(next).find((answer) => answer.questionId === questionId)?.optionId);
    if (nextQuestionId) { setFocusQuestionId(nextQuestionId); setFocusRequest((value) => value + 1); }
  };
  const selectedOptionId = (questionId: string) => activeAnswers.find((answer) => answer.questionId === questionId)?.optionId;

  const advance = () => {
    const unanswered = findUnansweredQuestionIds(page, selectedOptionId);
    if (unanswered.length) { setUnansweredQuestionIds(unanswered); setFocusQuestionId(unanswered[0]); setUnansweredFocusRequest((value) => value + 1); setFocusRequest((value) => value + 1); setError("未回答の質問があります。すべて回答してから次へ進んでください。"); return; }
    setUnansweredQuestionIds([]);
    setFocusQuestionId(undefined);
    startedAt.current = Date.now();
    if (pageIndex < pages.length - 1) { commit({ ...session, currentPageIndex: nextPageIndex(pageIndex, pages.length) }); return; }
    try {
      if (!session.typeResolution) {
        const nextSet = nextQuestionSetAfterCommon(session);
        if (!nextSet.route) {
          moveToQuestionSet({ ...session, typeResolution: nextSet.resolution }, nextSet.currentQuestionIds);
          return;
        }
        moveToQuestionSet({ ...session, typeResolution: nextSet.resolution, route: nextSet.route }, nextSet.currentQuestionIds);
        return;
      }
      if (!session.route) {
        if (session.typeResolution.kind !== "low-confidence" || session.typeResolution.candidates.length !== 2) throw new Error("Comparison state is invalid");
        const pair = [session.typeResolution.candidates[0], session.typeResolution.candidates[1]] as [TypeId, TypeId];
        const phase = comparisonPhaseFor(session);
        const comparison = scoreComparison(pair, comparisonAnswersForPair(pair, activeAnswers, phase), phase);
        if (comparison.status === "needs_more") { moveToQuestionSet({ ...session, comparisonResolution: comparison }, comparison.nextQuestionIds); return; }
        const resolution = resolveType(resolveCommon(activeAnswers).scores, comparison);
        const route = buildRoute(session, resolution, comparison);
        moveToQuestionSet({ ...session, typeResolution: resolution, comparisonResolution: comparison, route }, route.questionIds.filter((id) => !activeAnswers.some((answer) => answer.questionId === id)));
        return;
      }
      const prepared = prepareDiagnosisCompletion(session);
      if (prepared.currentQuestionIds.length) { moveToQuestionSet(prepared, prepared.currentQuestionIds); return; }
      commit(session);
      setScreen("confirmation");
    } catch (caught) { console.error("Diagnosis question processing failed", caught); setError("回答の処理中に問題が発生しました。ページを再読み込みして、もう一度お試しください。"); }
  };

  const goPrevious = () => {
    setError("");
    setUnansweredQuestionIds([]);
    setFocusQuestionId(undefined);
    if (pageIndex > 0) { commit({ ...session, currentPageIndex: previousPageIndex(pageIndex) }); return; }
    const previous = restorePreviousQuestionHistory(session);
    if (previous) commit(previous);
  };
  const selectCompletionConfirmation = (value: number) => commit({ ...session, completionConfirmation: value });
  const reviewAnswers = () => { setError(""); setUnansweredQuestionIds([]); setFocusQuestionId(undefined); setScreen("questions"); };
  const requestResultGeneration = () => {
    if (session.completionConfirmation === undefined || screen === "generation-pending") return;
    setGenerationError(undefined);
    setGenerationTitleIndex(0);
    setScreen("generation-pending");
  };
  const retryResultGeneration = () => {
    if (screen !== "generation-pending" || generationResultRef.current.sessionId) return;
    setGenerationError(undefined);
    setGenerationTitleIndex(0);
    setGenerationAttempt((value) => value + 1);
  };

  if (activeScreen === "resume-blocked") return <main className="screen intro-screen"><div className="shell"><header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>INNER NOTE</div></header><section className="center-main"><div className="panel blocked-panel"><p className="kicker">VERSION UPDATE</p><h1>保存済みの診断を<br/>再開できません。</h1><p>診断内容が更新されたため、保存済みの回答との互換性を確認できませんでした。安全のため、現在の保存内容は再開せず新しく始めてください。</p><div className="panel-actions"><button className="primary" onClick={() => { localStorage.removeItem(STORAGE_KEY); setSession(newSession()); setScreen("intro"); }}>新しく診断を開始する</button><button className="ghost" onClick={() => setScreen("top")}>トップへ戻る</button></div></div></section></div></main>;
  if (activeScreen === "result" && session.freeReport) return <><FreeResultPage report={session.freeReport} typeResolution={session.route?.typeResolution} onBack={() => setScreen("top")} onRestart={() => requestRestart("result")}/>{screen === "restart-confirm" && <RestartConfirmModal onCancel={() => setScreen(restartReturnScreen)} onConfirm={startFresh}/>}</>;

  return <>{activeScreen === "top" && <TopPage hasSavedProgress={hasSaved} onStart={() => setScreen("intro")} onResume={resume} onRestart={() => requestRestart("top")}/>} {activeScreen === "intro" && <DiagnosisIntro hasSavedProgress={hasSaved} onStart={hasSaved ? () => requestRestart("intro") : startFresh} onResume={resume} onRestart={() => requestRestart("intro")} onBack={() => setScreen("top")}/>} {activeScreen === "questions" && <QuestionScreen page={page} pageIndex={pageIndex} pageCount={pages.length} selectedOptionId={selectedOptionId} optionsFor={(question) => orderQuestionOptions(question, session.sessionSeed)} onAnswer={answer} onPrevious={goPrevious} onNext={advance} onPause={pause} error={error} unansweredQuestionIds={unansweredQuestionIds} unansweredFocusRequest={unansweredFocusRequest} focusQuestionId={focusQuestionId} focusRequest={focusRequest} navigationKey={questionNavigationKey(pageIndex, session.currentQuestionIds, stageFor(session))} canGoBack={pageIndex > 0 || Boolean(session.questionHistory?.length)}/>} {activeScreen === "confirmation" && <ConfirmationScreen selectedValue={session.completionConfirmation} isGenerationPending={screen === "generation-pending"} onSelect={selectCompletionConfirmation} onReview={reviewAnswers} onPause={pause} onCreateResults={requestResultGeneration}/>} {activeScreen === "generation-pending" && <LoadingScreen title={RESULT_LOADING_TITLES[generationTitleIndex]} error={generationError} onRetry={retryResultGeneration}/>} {screen === "restart-confirm" && <RestartConfirmModal onCancel={() => setScreen(restartReturnScreen)} onConfirm={startFresh}/>}</>;
}
