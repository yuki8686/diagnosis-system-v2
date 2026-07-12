import type { QuestionDefinition } from "../../types";

function copyFor(question: QuestionDefinition | undefined) {
  if (question?.block === "type-comparison") return { eyebrow: "COMPARISON SET", title: "より自分に近い方を選んでください。", body: "どちらも完全には当てはまらなくても、より近い方を選んでください。" };
  return { eyebrow: "QUESTION SET", title: "今のあなたに近いものを選んでください。", body: "すべて回答すると、次へ進めます。" };
}

export function ProgressHeader({ question, progress }: { question?: QuestionDefinition; progress: number }) {
  const copy = copyFor(question);
  return <><div className="progress" aria-label={`進行状況 ${progress}%`}><span style={{ width: `${progress}%` }}/></div><div className="progress-note">あなたの回答に合わせて進んでいます</div><div className="page-head"><div className="eyebrow">{copy.eyebrow}</div><h2>{copy.title}</h2><p>{copy.body}</p></div></>;
}
