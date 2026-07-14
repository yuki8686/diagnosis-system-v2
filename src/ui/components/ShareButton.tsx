import { useState } from "react";
import { DIAGNOSIS_DISPLAY_NAME, diagnosisShareText } from "../brand";

export function ShareButton({ className = "share-top", label = "↗ シェア", characterName }: { className?: string; label?: string; characterName?: string }) {
  const [message, setMessage] = useState("");
  const share = async () => {
    const data = { title: DIAGNOSIS_DISPLAY_NAME, text: diagnosisShareText(characterName), url: window.location.href };
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
