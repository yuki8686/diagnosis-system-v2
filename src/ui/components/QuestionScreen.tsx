import { useEffect, useRef } from "react";
import type { ChoiceOption, QuestionDefinition } from "../../types";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { ComparisonQuestion } from "./ComparisonQuestion";
import { LikertQuestion } from "./LikertQuestion";
import { ProgressHeader } from "./ProgressHeader";
import { QuestionNavigation } from "./QuestionNavigation";

interface QuestionScreenProps {
  page: QuestionDefinition[];
  pageIndex: number;
  pageCount: number;
  selectedOptionId: (questionId: string) => string | undefined;
  optionsFor: (question: QuestionDefinition) => ChoiceOption[];
  onAnswer: (question: QuestionDefinition, option: ChoiceOption) => void;
  onPrevious: () => void;
  onNext: () => void;
  onPause: () => void;
  error: string;
  unansweredQuestionIds: string[];
  unansweredFocusRequest: number;
  focusQuestionId?: string;
  focusRequest: number;
  navigationKey: string;
  canGoBack: boolean;
}

export function QuestionScreen(props: QuestionScreenProps) {
  const progress = Math.round(((props.pageIndex + 1) / Math.max(1, props.pageCount)) * 100);
  const scrollTopRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const frame = requestAnimationFrame(() => scrollTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [props.navigationKey]);

  useEffect(() => {
    if (!props.focusQuestionId) return;
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-question-id="${props.focusQuestionId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      const answerButton = card.querySelector<HTMLButtonElement>("button");
      answerButton?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [props.focusQuestionId, props.focusRequest, props.unansweredFocusRequest]);

  return <section className="screen active question-screen"><div className="shell question-wrap"><header className="topbar"><div className="brand"><span className="brand-mark"/>本音キャラ診断</div><button className="linkbtn" onClick={props.onPause}>中断する</button></header><div className="question-scroll-target" ref={scrollTopRef}/><ProgressHeader question={props.page[0]} progress={progress}/><div className="question-list">{props.page.map((question) => <QuestionCard key={question.id} question={question} selected={props.selectedOptionId(question.id)} options={props.optionsFor(question)} isUnanswered={props.unansweredQuestionIds.includes(question.id)} onAnswer={(option) => props.onAnswer(question, option)}/>)}</div><QuestionNavigation canGoBack={props.canGoBack} isLastPage={props.pageIndex === props.pageCount - 1} error={props.error} onPrevious={props.onPrevious} onNext={props.onNext}/></div></section>;
}

function QuestionCard({ question, selected, options, isUnanswered, onAnswer }: { question: QuestionDefinition; selected?: string; options: ChoiceOption[]; isUnanswered: boolean; onAnswer: (option: ChoiceOption) => void }) {
  if (question.block === "type-comparison") return <ComparisonQuestion question={question} selected={selected} options={options} isUnanswered={isUnanswered} onAnswer={onAnswer}/>;
  if (question.format === "likert-5") return <LikertQuestion question={question} selected={selected} options={options} isUnanswered={isUnanswered} onAnswer={onAnswer}/>;
  return <ChoiceQuestion question={question} selected={selected} options={options} isUnanswered={isUnanswered} onAnswer={onAnswer}/>;
}
