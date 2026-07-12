interface LoadingScreenProps {
  title: string;
  error?: string;
  onRetry: () => void;
}

export function LoadingScreen({ title, error, onRetry }: LoadingScreenProps) {
  if (error) return <section className="screen active"><div className="loading-wrap"><section className="loading-card" role="alert"><div className="layers" aria-hidden="true"><div className="layer"/><div className="layer"/><div className="layer"/></div><h2>診断結果を作成できませんでした</h2><p>{error}</p><button className="primary loading-retry" onClick={onRetry}>もう一度試す</button></section></div></section>;
  return <section className="screen active"><div className="loading-wrap"><section className="loading-card" role="status" aria-live="polite"><div className="layers" aria-hidden="true"><div className="layer"/><div className="layer"/><div className="layer"/></div><h2>{title}</h2><p>人に見せている自分と、本音の違いを読み取っています。</p></section></div></section>;
}
