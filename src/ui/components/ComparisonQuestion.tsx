import { Fragment } from "react";
import type { ChoiceOption, QuestionDefinition } from "../../types";

export function ComparisonQuestion({ question, selected, options, isUnanswered, onAnswer }: { question: QuestionDefinition; selected?: string; options: ChoiceOption[]; isUnanswered: boolean; onAnswer: (option: ChoiceOption) => void }) {
  return <article className={isUnanswered ? "ab-card unanswered" : "ab-card"} data-question-id={question.id} tabIndex={-1}><p className="q-text">{question.prompt}</p><div className="ab-options" role="group" aria-label={question.prompt}>{options.map((option, index) => <Fragment key={option.id}><button type="button" className={selected === option.id ? "ab-option selected" : "ab-option"} aria-pressed={selected === option.id} onClick={() => onAnswer(option)}><span className="ab-label">{index === 0 ? "A" : "B"}</span><span className="ab-copy">{option.label}</span></button>{index === 0 && <div className="or">OR</div>}</Fragment>)}</div></article>;
}
