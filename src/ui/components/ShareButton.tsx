import { useState } from "react";

export function ShareButton({ className = "share-top", label = "↗ シェア" }: { className?: string; label?: string }) {
  const [message, setMessage] = useState("");
  const share = async () => {
    const data = { title: "INNER NOTE", text: "人に見せている私と、本当の私のあいだ。自分の行動パターンを読み解く診断。", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(data.url); setMessage("ページのURLをコピーしました"); }
      else { window.prompt("このURLをコピーしてください", data.url); }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setMessage("共有を開始できませんでした");
    }
  };
  return <span className="share-wrap"><button type="button" className={className} onClick={share}>{label}</button>{message && <span className="share-message" role="status">{message}</span>}</span>;
}
