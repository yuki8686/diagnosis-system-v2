import type { FreeReport, TypeResolution } from "../../types";
import { conditionsViewModel, confidenceLabel, gapViewModel, numberedResultChapters, privateSelfViewModel, publicSelfViewModel, resultStatusBanner, secondaryTypeNote, type ResultChapterKey, visibleFreeReportSection, visibleFreeReportSections } from "../free-result";
import { ShareButton } from "./ShareButton";

interface FreeResultPageProps {
  report: FreeReport;
  typeResolution?: TypeResolution;
  onBack: () => void;
  onRestart: () => void;
}

function ResultTextSection({ chapter, section }: { chapter: string; section: ReturnType<typeof visibleFreeReportSection> extends infer T ? Exclude<T, undefined> : never }) {
  return <section className="result-section" aria-labelledby={`free-result-${section.id}`}>
    <p className="section-no">{chapter}</p>
    <h2 id={`free-result-${section.id}`}>{section.title}</h2>
    {section.paragraphs.map((text, index) => <p key={`${section.id}-${index}`}>{text}</p>)}
  </section>;
}

export function FreeResultPage({ report, typeResolution, onBack, onRestart }: FreeResultPageProps) {
  const headline = visibleFreeReportSection(report, "headline");
  const publicSelf = publicSelfViewModel(report);
  const privateSelf = privateSelfViewModel(report);
  const gap = gapViewModel(report);
  const conditions = conditionsViewModel(report);
  const sections = visibleFreeReportSections(report, { includeExpression: !publicSelf });
  const coreDesire = sections.find((section) => section.id === "core_desire");
  const expression = sections.find((section) => section.id === "expression");
  const observation = sections.find((section) => section.id === "observation");
  const visibleChapterKeys = [
    coreDesire ? "core" : undefined,
    expression ? "expression" : undefined,
    publicSelf ? "public-self" : undefined,
    privateSelf ? "private-self" : undefined,
    "gap",
    conditions ? "condition" : undefined,
    observation ? "observation" : undefined,
  ].filter((key): key is ResultChapterKey => key !== undefined);
  const chapterByKey = new Map(numberedResultChapters(visibleChapterKeys).map(({ key, chapter }) => [key, chapter]));
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
      {coreDesire && <ResultTextSection chapter={chapterByKey.get("core")!} section={coreDesire}/>}
      {expression && <ResultTextSection chapter={chapterByKey.get("expression")!} section={expression}/>}

      {publicSelf && <section className="result-section" aria-labelledby="free-result-public-self">
        <p className="section-no">{chapterByKey.get("public-self")}</p>
        <h2 id="free-result-public-self">人から見えているあなた</h2>
        <ul className="soft-list">
          {publicSelf.traits.map((trait) => <li className="soft-item" key={trait.id}>{trait.text}</li>)}
        </ul>
        {publicSelf.misunderstanding && <aside className="inside-card" aria-labelledby="free-result-misunderstanding">
          <h3 id="free-result-misunderstanding">誤解されやすい点</h3>
          <p>{publicSelf.misunderstanding.text}</p>
        </aside>}
      </section>}

      {privateSelf && <section className="result-section" aria-labelledby="free-result-private-self">
        <p className="section-no">{chapterByKey.get("private-self")}</p>
        <h2 id="free-result-private-self">でも、内側では</h2>
        {privateSelf.paragraphs.map((paragraph) => <p key={paragraph.id}>{paragraph.text}</p>)}
      </section>}

      <section className="result-section" aria-labelledby="free-result-gap">
        <p className="section-no">{chapterByKey.get("gap")}</p>
        <h2 id="free-result-gap">人に見せている自分と、本音のズレ</h2>
        {gap.stateLabel && <p className="gap-state">{gap.stateLabel}</p>}
        {gap.paragraphs.map((paragraph) => <p key={paragraph.id}>{paragraph.text}</p>)}
        <ul className="locked-preview" aria-label="詳細レポートで表示される内容">
          {gap.lockedItems.map((item) => <li className="locked-item" key={item.title}>
            <span>{item.title}</span><span className="locked-hint">{item.hint}</span><span className="locked-icon" aria-hidden="true">🔒</span>
          </li>)}
        </ul>
      </section>

      {conditions && <section className="result-section" aria-labelledby="free-result-conditions">
        <p className="section-no">{chapterByKey.get("condition")}</p>
        <h2 id="free-result-conditions">力が出る状態と、止まりやすい状態</h2>
        <div className="state-grid">
          <section className="state-card" aria-labelledby="free-result-energizing">
            <h3 id="free-result-energizing">力を出しやすいと考えられる条件</h3>
            <ul>{conditions.energizing.map((condition) => <li key={condition.id}>{condition.text}</li>)}</ul>
          </section>
          <section className="state-card" aria-labelledby="free-result-blocking">
            <h3 id="free-result-blocking">止まりやすさが出る可能性がある条件</h3>
            <ul>{conditions.blocking.map((condition) => <li key={condition.id}>{condition.text}</li>)}</ul>
          </section>
        </div>
      </section>}
      {observation && <ResultTextSection chapter={chapterByKey.get("observation")!} section={observation}/>}
      {disclaimer && <section className="result-footnote" aria-labelledby="free-result-disclaimer">
        <h2 id="free-result-disclaimer">{disclaimer.title}</h2>
        {disclaimer.paragraphs.map((text, index) => <p key={`${disclaimer.id}-${index}`}>{text}</p>)}
      </section>}
    </div>

    <div className="share-row result-actions"><ShareButton className="secondary" label="診断ページをシェア"/><button type="button" className="ghost" onClick={onRestart}>もう一度診断する</button></div>
  </div></main>;
}
