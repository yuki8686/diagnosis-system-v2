import { useState } from "react";

const FEEDBACK_COMMENT_MAX_LENGTH = 500;
type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export function FeedbackForm({ onSave }: { onSave: (rating: FeedbackRating, comment: string) => Promise<void> }) {
  const [rating, setRating] = useState<FeedbackRating>();
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    if (!rating || saved) return;
    setSaving(true); setError(undefined);
    try { await onSave(rating, comment); setSaved(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "フィードバックを保存できませんでした。"); }
    finally { setSaving(false); }
  };

  return <section className="result-section feedback-card" aria-labelledby="result-feedback-title">
    <p className="section-no">FEEDBACK</p>
    <h2 id="result-feedback-title">この結果は、今のあなたにどのくらい当てはまりましたか？</h2>
    <p>フィードバックは診断精度の改善に使用します。個人情報は入力しないでください。</p>
    <div className="feedback-scale" role="group" aria-label="当てはまり度">
      {([1, 2, 3, 4, 5] as const).map((value) => <button type="button" className={`feedback-btn${rating === value ? " selected" : ""}`} aria-pressed={rating === value} disabled={saved} onClick={() => setRating(value)} key={value}>{value}{value === 1 && <small>低い</small>}{value === 5 && <small>高い</small>}</button>)}
    </div>
    <label className="feedback-comment"><span>任意コメント</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={FEEDBACK_COMMENT_MAX_LENGTH} disabled={saved || saving} rows={4}/></label>
    <div className="feedback-actions"><button type="button" className="secondary" disabled={!rating || saved || saving} onClick={save}>{saving ? "保存しています…" : "フィードバックを送る"}</button>{saved && <p role="status">フィードバックを保存しました。ご協力ありがとうございます。</p>}{error && <p className="form-error" role="alert">{error}</p>}</div>
  </section>;
}
