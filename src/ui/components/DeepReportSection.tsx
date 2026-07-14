import type { VisiblePaidReport } from "../paid-result";
import { characterDisplayCopyForLabel } from "../../report/templates/labels";

export function DeepReportSection({ report }: { report?: VisiblePaidReport }) {
  if (!report) return <section className="result-section deep-report-error" role="alert" aria-labelledby="deep-report-error-title"><p className="eyebrow">DEEP REPORT</p><h2 id="deep-report-error-title">詳しいレポートを表示できません</h2><p>もう一度結果画面を開いてください。解決しない場合は、診断をやり直してください。</p></section>;
  const character = characterDisplayCopyForLabel(report.label);
  return <section className="deep-report" aria-labelledby="deep-report-title">
    <section className="result-section deep-report-hero">
      <p className="eyebrow">DEEP REPORT</p>
      <p className="result-type-label">あなたの本音キャラは</p>
      <h2 id="deep-report-title">{character?.characterName ?? report.label}</h2>
      <div className="deep-report-subtitle"><strong>表れ方</strong><p>{character?.expressionDescription ?? report.subtitle}</p></div>
    </section>
    {report.sections.map((section, index) => <section className="result-section" key={`${section.title}-${index}`} aria-labelledby={`deep-report-section-${index}`}>
      <p className="section-no">{String(index + 1).padStart(2, "0")} / DEEP REPORT</p>
      <h2 id={`deep-report-section-${index}`}>{section.title}</h2>
      {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{character && index === 0 && paragraphIndex === 0 ? character.headline : paragraph}</p>)}
    </section>)}
  </section>;
}
