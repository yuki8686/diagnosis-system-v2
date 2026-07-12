import type { FreeReport, TypeResolution } from "../../types";
import { confidenceLabel, resultSectionChapter, resultStatusBanner, secondaryTypeNote, visibleFreeReportSection, visibleFreeReportSections } from "../free-result";
import { ShareButton } from "./ShareButton";

interface FreeResultPageProps {
  report: FreeReport;
  typeResolution?: TypeResolution;
  onBack: () => void;
  onRestart: () => void;
}

export function FreeResultPage({ report, typeResolution, onBack, onRestart }: FreeResultPageProps) {
  const headline = visibleFreeReportSection(report, "headline");
  const sections = visibleFreeReportSections(report);
  const disclaimer = visibleFreeReportSection(report, "disclaimer");
  const status = resultStatusBanner(report, typeResolution);
  const secondary = secondaryTypeNote(report, typeResolution);

  return <main className="screen active result-page"><div className="shell result-wrap">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"/>INNER NOTE</div><button type="button" className="linkbtn" onClick={onBack}>トップへ戻る</button></header>

    {status && <section className={`result-status show ${status.tone}`} role="status" aria-live="polite"><strong>{status.title}</strong><p>{status.body}</p></section>}

    <section className="result-hero" aria-labelledby="free-result-title">
      <p className="kicker">YOUR INNER NOTE</p>
      <p className="result-type-label">あなたのタイプ</p>
      <h1 id="free-result-title">{report.label}</h1>
      <p className="result-subtype">{report.subtitle}</p>
      {headline?.paragraphs.map((text, index) => <p className="result-quote" key={`${headline.id}-${index}`}>{text}</p>)}
      <p className="result-summary">{report.summary}</p>
      <p className="confidence-pill"><span className="confidence-dot" aria-hidden="true"/><span>{confidenceLabel(report.metadata.typeConfidence)}</span></p>
      {secondary && <p className="secondary-type-note show">{secondary}</p>}
    </section>

    <div className="result-stack">
      {sections.map((section) => <section className="result-section" key={section.id} aria-labelledby={`free-result-${section.id}`}>
        <p className="section-no">{resultSectionChapter(section.id)}</p>
        <h2 id={`free-result-${section.id}`}>{section.title}</h2>
        {section.paragraphs.map((text, index) => <p key={`${section.id}-${index}`}>{text}</p>)}
      </section>)}
      {disclaimer && <section className="result-footnote" aria-labelledby="free-result-disclaimer">
        <h2 id="free-result-disclaimer">{disclaimer.title}</h2>
        {disclaimer.paragraphs.map((text, index) => <p key={`${disclaimer.id}-${index}`}>{text}</p>)}
      </section>}
    </div>

    <div className="share-row result-actions"><ShareButton className="secondary" label="診断ページをシェア"/><button type="button" className="ghost" onClick={onRestart}>もう一度診断する</button></div>
  </div></main>;
}
