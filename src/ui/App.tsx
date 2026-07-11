import { useMemo, useRef, useState } from "react";
import { orderQuestionOptions } from "../routing";
import { resolveType } from "../scoring";
import type { ChoiceOption, QuestionDefinition, TypeId } from "../types";
import { toAnswer } from "./adapter";
import { buildRoute, commonQuestions, comparisonQuestions, finishDiagnosis, questionsForIds, resolveCommon, scoreComparison } from "./engine";
import { buildQuestionPages } from "./page-builder";
import { loadSession, newSession, saveSession, STORAGE_KEY, upsertAnswer, type DiagnosisSession } from "./session";
import "./styles.css";

type View = "home" | "questions" | "mismatch" | "result";
const initial = loadSession();

export default function App() {
  const [session, setSession] = useState<DiagnosisSession>(() => initial.kind === "current" ? initial.session : newSession());
  const [view, setView] = useState<View>(() => initial.kind === "version-mismatch" ? "mismatch" : initial.kind === "current" ? "home" : "home");
  const [error, setError] = useState("");
  const startedAt = useRef(Date.now());
  const questionList = useMemo(() => session.currentQuestionIds.length ? questionsForIds(session.currentQuestionIds) : commonQuestions, [session.currentQuestionIds]);
  const pages = useMemo(() => buildQuestionPages(questionList), [questionList]);
  const page = pages[session.currentPageIndex] ?? pages[0] ?? [];
  const hasSavedProgress = session.answers.length > 0 || session.currentQuestionIds.length > 0;

  const commit = (next: DiagnosisSession) => { setSession(next); saveSession(next); };
  const start = () => { const next = newSession(); next.currentQuestionIds = commonQuestions.map((q) => q.id); commit(next); setView("questions"); };
  const resume = () => setView(session.freeReport ? "result" : "questions");
  const answer = (question: QuestionDefinition, option: ChoiceOption) => { commit({ ...session, answers: upsertAnswer(session.answers, toAnswer(question, option, startedAt.current)) }); setError(""); };
  const selected = (id: string) => session.answers.find((answer) => answer.questionId === id)?.optionId;

  const next = () => {
    if (page.some((question) => !selected(question.id))) { setError("未回答の質問があります。すべて回答してください。"); return; }
    startedAt.current = Date.now();
    if (session.currentPageIndex < pages.length - 1) { commit({ ...session, currentPageIndex: session.currentPageIndex + 1 }); return; }
    try {
      if (!session.typeResolution) {
        const { scores, resolution } = resolveCommon(session.answers);
        if (resolution.kind === "low-confidence" && resolution.candidates.length === 2) {
          const pair = [resolution.candidates[0], resolution.candidates[1]] as [TypeId, TypeId];
          const ids = comparisonQuestions(pair).slice(0, 2).map((q) => q.id);
          commit({ ...session, typeResolution: resolution, currentQuestionIds: ids, currentPageIndex: 0 }); return;
        }
        const route = buildRoute(session, resolution);
        commit({ ...session, typeResolution: resolution, route, currentQuestionIds: route.questionIds.filter((id) => !session.answers.some((answer) => answer.questionId === id)), currentPageIndex: 0 }); return;
      }
      if (!session.route) {
        if (session.typeResolution.kind !== "low-confidence" || session.typeResolution.candidates.length !== 2) throw new Error("Comparison state is invalid");
        const pair = [session.typeResolution.candidates[0], session.typeResolution.candidates[1]] as [TypeId, TypeId];
        const comparison = scoreComparison(pair, session.answers, session.comparisonResolution?.status === "needs_more" ? "additional" : "initial");
        if (comparison.status === "needs_more") { commit({ ...session, comparisonResolution: comparison, currentQuestionIds: comparison.nextQuestionIds, currentPageIndex: 0 }); return; }
        const scores = scoreBaseTypesSafe(session);
        const resolution = resolveType(scores, comparison);
        const route = buildRoute(session, resolution, comparison);
        commit({ ...session, typeResolution: resolution, comparisonResolution: comparison, route, currentQuestionIds: route.questionIds.filter((id) => !session.answers.some((answer) => answer.questionId === id)), currentPageIndex: 0 }); return;
      }
      const finished = finishDiagnosis(session);
      commit(finished);
      if (finished.freeReport) { localStorage.removeItem(STORAGE_KEY); setView("result"); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "診断結果を生成できませんでした。"); }
  };

  if (view === "mismatch") return <main className="center"><section className="panel"><p className="eyebrow">VERSION UPDATE</p><h1>診断データを再開できません</h1><p>診断内容が更新されたため、保存済み回答との互換性がありません。</p><button onClick={() => { localStorage.removeItem(STORAGE_KEY); start(); }}>最初から診断する</button></section></main>;
  if (view === "result" && session.freeReport) return <main><header className="brand">INNER NOTE</header><section className="hero result"><p className="eyebrow">YOUR INNER NOTE</p><h1>{session.freeReport.label}</h1><p className="lead">{session.freeReport.subtitle}</p><p>{session.freeReport.summary}</p></section>{session.freeReport.sections.map((section) => <section className="panel report" key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((p) => <p key={p.id}>{p.text}</p>)}</section>)}<section className="locked"><h2>もっと詳しく知る</h2><p>詳しいレポートでは、ズレ・防衛反応・使いこなしと具体的な提案を確認できます。</p><button disabled>有料レポート（接続準備中）</button></section></main>;
  if (view === "home") return <main><header className="brand">INNER NOTE</header><section className="hero"><p className="eyebrow">DIAGNOSIS SYSTEM ver.2</p><h1>人に見せている私と、<br/>内側で動いている私。</h1><p className="lead">本能、欲望、その出し方、ズレ、防衛反応を回答から整理します。</p><div className="facts"><span>所要時間：約10分前後</span><span>途中保存できます</span></div>{hasSavedProgress ? <><button onClick={resume}>診断を続ける</button><button className="secondary" onClick={start}>最初からやり直す</button></> : <button onClick={start}>無料で診断する</button>}</section></main>;
  const progress = Math.round(((session.currentPageIndex + 1) / Math.max(1, pages.length)) * 100);
  return <main><header className="brand">INNER NOTE <button className="text" onClick={() => { saveSession(session); setView("home"); }}>保存して中断</button></header><section className="question-shell"><div className="progress"><span style={{ width: `${progress}%` }}/></div><p className="step">STEP {session.currentPageIndex + 1}</p>{page.map((question) => <QuestionCard key={question.id} question={question} seed={session.sessionSeed} selected={selected(question.id)} onAnswer={(option) => answer(question, option)}/>) }{error && <p className="error" role="alert">{error}</p>}<button onClick={next}>次へ進む</button></section></main>;
}

function scoreBaseTypesSafe(session: DiagnosisSession) { return resolveCommon(session.answers).scores; }

function QuestionCard({ question, seed, selected, onAnswer }: { question: QuestionDefinition; seed: string; selected?: string; onAnswer: (option: ChoiceOption) => void }) {
  const options = orderQuestionOptions(question, seed);
  return <article className="question-card"><p className="qnum">{question.id}</p><h2>{question.prompt}</h2><div className={question.format === "likert-5" ? "likert" : "choices"}>{options.map((option) => <button aria-pressed={selected === option.id} className={selected === option.id ? "option selected" : "option"} key={option.id} onClick={() => onAnswer(option)}>{option.label}</button>)}</div></article>;
}
