const confirmationValues = [1, 2, 3, 4, 5] as const;

interface ConfirmationScreenProps {
  selectedValue?: number;
  isGenerationPending: boolean;
  onSelect: (value: number) => void;
  onReview: () => void;
  onPause: () => void;
  onCreateResults: () => void;
}

export function ConfirmationScreen({ selectedValue, isGenerationPending, onSelect, onReview, onPause, onCreateResults }: ConfirmationScreenProps) {
  return <section className="screen active"><div className="shell question-wrap"><header className="topbar"><div className="brand"><span className="brand-mark"/>INNER NOTE</div><button className="linkbtn" onClick={onPause}>中断する</button></header><div className="progress"><span style={{ width: "96%" }}/></div><section className="confirm-card"><div className="confirm-banner">最後に確認させてください</div><h2>ここまでの質問で答えた自分は、普段のあなたに近いと感じますか？</h2><div className="scale-labels" aria-hidden="true"><span>まったくそう思わない</span><span>とてもそう思う</span></div><div className="likert" aria-label="普段の自分への当てはまり度" role="group">{confirmationValues.map((value) => <button key={value} type="button" className={selectedValue === value ? "likert-btn selected" : "likert-btn"} aria-pressed={selectedValue === value} onClick={() => onSelect(value)}><span className="circle"/><span>{value}</span></button>)}</div><div className="page-actions confirm-actions"><button className="secondary" onClick={onReview}>前のページへ</button><button className="primary" disabled={!canCreateResults(selectedValue, isGenerationPending)} onClick={onCreateResults}>結果を見る</button></div></section></div></section>;
}
import { canCreateResults } from "../question-state";
