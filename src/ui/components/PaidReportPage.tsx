import { useEffect, useState } from "react";
import type { VisiblePaidReport } from "../paid-result";
import { DeepReportSection } from "./DeepReportSection";

function validReport(value: unknown): value is VisiblePaidReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<VisiblePaidReport>;
  return typeof report.label === "string" && typeof report.subtitle === "string" && Array.isArray(report.sections);
}

export function PaidReportPage({ accessToken }: { accessToken: string }) {
  const [report, setReport] = useState<VisiblePaidReport>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void fetch(`/api/paid-report/${encodeURIComponent(accessToken)}`, { headers: { Accept: "application/json" } })
      .then(async (response) => ({ response, value: await response.json().catch(() => undefined) }))
      .then(({ response, value }) => {
        if (!active) return;
        if (!response.ok || !validReport(value)) { setError("レポートを表示できません。購入後180日以内の専用URLをご確認ください。"); return; }
        setReport(value);
      })
      .catch(() => { if (active) setError("レポートを表示できません。時間をおいてもう一度お試しください。"); });
    return () => { active = false; };
  }, [accessToken]);
  return <main className="screen active result-page"><div className="shell result-wrap"><header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>INNER NOTE</div></header>{report ? <DeepReportSection report={report}/> : <section className="result-section" aria-live="polite"><p className="eyebrow">DEEP REPORT</p><h1>{error ?? "詳しいレポートを読み込んでいます"}</h1>{!error && <p>しばらくお待ちください。</p>}</section>}</div></main>;
}
