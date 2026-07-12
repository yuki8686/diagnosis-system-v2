export function QuestionNavigation({ canGoBack, isLastPage, error, onPrevious, onNext }: { canGoBack: boolean; isLastPage: boolean; error: string; onPrevious: () => void; onNext: () => void }) {
  return <div className="page-actions"><button className="secondary" disabled={!canGoBack} onClick={onPrevious}>前のページへ</button><div className={error ? "error-note show" : "error-note"} role={error ? "alert" : undefined}>{error || "未回答の質問があります。"}</div><button className="primary" onClick={onNext}>{isLastPage ? "次へ" : "次のページへ"}</button></div>;
}
