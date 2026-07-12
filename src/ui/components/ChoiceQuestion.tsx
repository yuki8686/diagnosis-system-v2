import type { ChoiceOption, QuestionDefinition } from "../../types";

export function ChoiceQuestion({ question, selected, options, isUnanswered, onAnswer }: { question: QuestionDefinition; selected?: string; options: ChoiceOption[]; isUnanswered: boolean; onAnswer: (option: ChoiceOption) => void }) {
  return <article className={isUnanswered ? "question-card unanswered" : "question-card"} data-question-id={question.id} tabIndex={-1}><p className="q-text">{question.prompt}</p><div className="choice-grid" role="group" aria-label={question.prompt}>{options.map((option) => <button type="button" className={selected === option.id ? "choice-option selected" : "choice-option"} aria-pressed={selected === option.id} key={option.id} onClick={() => onAnswer(option)}>{option.label}</button>)}</div></article>;
}
