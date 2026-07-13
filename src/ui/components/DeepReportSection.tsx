import type { VisiblePaidReport } from "../paid-result";

export function DeepReportSection({ report }: { report?: VisiblePaidReport }) {
  if (!report) return <section className="result-section deep-report-error" role="alert" aria-labelledby="deep-report-error-title"><p className="eyebrow">DEEP REPORT</p><h2 id="deep-report-error-title">詳しいレポートを表示できません</h2><p>もう一度結果画面を開いてください。解決しない場合は、診断をやり直してください。</p></section>;
  return <section className="deep-report" aria-labelledby="deep-report-title">
    <section className="result-section deep-report-hero">
      <p className="eyebrow">DEEP REPORT</p>
      <h2 id="deep-report-title">{report.label}</h2>
      <p className="deep-report-subtitle">{report.subtitle}</p>
    </section>
    {report.sections.map((section, index) => <section className="result-section" key={`${section.title}-${index}`} aria-labelledby={`deep-report-section-${index}`}>
      <p className="section-no">{String(index + 1).padStart(2, "0")} / DEEP REPORT</p>
      <h2 id={`deep-report-section-${index}`}>{section.title}</h2>
      {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
    </section>)}
  </section>;
}
