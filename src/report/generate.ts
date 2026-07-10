import { DEFENSE_LABELS, TYPE_LABELS } from "../constants";
import type { ActionProposal, DiagnosisBlock, FreeReport, PaidReport, PersonalizationAnchor, ReportInput, ReportMetadata, ReportParagraph, ReportRoute, ReportSection, ReportSectionId, TypeId } from "../types";
import { buildAnchors, buildAnswerReferences } from "./anchors";
import { evidenceFor, qualifierFor } from "./evidence";
import { PaidReportQualityError, validatePaidReport } from "./quality";
import { EXPRESSION_COPY, resolvedLabel, resolvedSubtitle, TYPE_REPORT_TEMPLATES } from "./templates/labels";

const TITLES: Record<ReportSectionId, string> = {
  headline: "診断結果の全体像",
  core_desire: "大切にしやすいもの",
  expression: "欲望の出し方",
  gap: "本音側と対人側の差",
  defense: "負荷がかかった場面の反応",
  utilization: "気づきと使いこなし",
  strengths: "活かしやすい力",
  friction: "つまずきやすい条件",
  relationships: "関係場面での可能性",
  work: "仕事場面での可能性",
  action: "次に試すこと",
  observation: "観察ポイント",
  disclaimer: "この結果の読み方",
};

function reportRoute(input: ReportInput): ReportRoute {
  return input.result.resolution.kind === "resolved" ? "resolved" : "low_confidence";
}

function validateReportInput(input: ReportInput): void {
  const expectedRoute = input.result.resolution.kind === "resolved" ? "resolved" : "low-confidence";
  if (input.result.route !== expectedRoute || input.route.route !== expectedRoute) throw new Error("Report input route and type resolution are inconsistent");
  if (JSON.stringify(input.result.resolution) !== JSON.stringify(input.route.typeResolution)) throw new Error("Report input result and routing type resolutions differ");
  const references = buildAnswerReferences(input.answers, input.questions);
  const answerIds = new Set(references.map((reference) => reference.questionId));
  for (const id of input.result.answeredQuestionIds) if (!answerIds.has(id)) throw new Error(`Report input is missing a result answer: ${id}`);
  for (const id of input.route.answeredQuestionIds) if (!answerIds.has(id)) throw new Error(`Report input is missing a route answer: ${id}`);
}

function metadata(input: ReportInput): ReportMetadata {
  const result = input.result;
  const route = input.route;
  const versions = ["questionBankVersion", "scoringVersion", "engineVersion", "reportTemplateVersion"] as const;
  for (const key of versions) {
    if (!result.metadata[key] || !route[key] || result.metadata[key] !== route[key]) throw new Error(`Report version mismatch or missing: ${key}`);
  }
  return {
    sessionId: route.sessionId,
    questionBankVersion: result.metadata.questionBankVersion,
    scoringVersion: result.metadata.scoringVersion,
    engineVersion: result.metadata.engineVersion,
    reportTemplateVersion: result.metadata.reportTemplateVersion,
    typeConfidence: result.confidence.type,
    expressionConfidence: result.confidence.expression,
    gapConfidence: result.confidence.gap,
    defenseConfidence: result.confidence.defense,
    utilizationConfidence: result.confidence.utilization,
  };
}

function primaryType(input: ReportInput): TypeId {
  return input.result.resolution.kind === "resolved" ? input.result.resolution.primary : input.result.resolution.candidates[0];
}

function labelFor(input: ReportInput): string {
  const resolution = input.result.resolution;
  return resolution.kind === "resolved"
    ? resolvedLabel(resolution.primary, input.result.expression.pattern)
    : resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join(" × ");
}

function sourceFor(input: ReportInput, block: DiagnosisBlock): string[] {
  const fallback = input.result.answeredQuestionIds.slice(0, 1);
  if (block === "expression") return input.result.expression.usedQuestionIds.length ? input.result.expression.usedQuestionIds : fallback;
  if (block === "gap") return input.result.gap.usedQuestionIds.length ? input.result.gap.usedQuestionIds : fallback;
  if (block === "defense") return input.result.defense.usedQuestionIds.length ? input.result.defense.usedQuestionIds : fallback;
  if (block === "utilization") return input.result.utilization.usedQuestionIds.length ? input.result.utilization.usedQuestionIds : fallback;
  return input.result.answeredQuestionIds.filter((id) => input.questions.find((question) => question.id === id && (question.block === "common-type" || question.block === "type-comparison"))).slice(0, 4).length
    ? input.result.answeredQuestionIds.filter((id) => input.questions.find((question) => question.id === id && (question.block === "common-type" || question.block === "type-comparison"))).slice(0, 4)
    : fallback;
}

function paragraph(input: ReportInput, id: string, text: string, block: DiagnosisBlock, level: "direct" | "derived" | "inferred" | "possibility", sourceIds: string[], anchorIds: string[] = [], scope: "general" | "specific_answer" | "work_possibility" | "relationship_possibility" = "general", scores?: Record<string, number | string | boolean>): ReportParagraph {
  return { id, text, evidence: evidenceFor(input, block, level, sourceIds, scope, scores), anchorIds };
}

function section(id: ReportSectionId, paragraphs: ReportParagraph[]): ReportSection {
  return { id, title: TITLES[id], paragraphs };
}

function gapText(input: ReportInput, detailed: boolean): string {
  const gap = input.result.gap;
  const names = { small: "ズレ小", suppression: "抑圧方向", amplification: "演出方向", reversal: "場面による反転", unclear: "方向不明瞭" } as const;
  if (!detailed) return `${qualifierFor(input, "gap")}本音側と対人側の回答から、${names[gap.pattern]}の通知が出ています。`;
  const breadth = gap.breadth >= 4 ? "幅広い場面" : gap.breadth >= 2 ? "複数の場面" : "一部の場面";
  return `${qualifierFor(input, "gap")}最大差の場面を含む回答差は${names[gap.pattern]}で、強度は${gap.strength ?? "方向別の強度なし"}、広がりは${breadth}として算出されました。確認状態は${gap.confirmationStatus}です。`;
}

function defenseText(input: ReportInput): string {
  const defense = input.result.defense;
  if (defense.primaryTied.length) return `今回の回答では、${defense.primaryTied.map((id) => DEFENSE_LABELS[id]).join(" と ")}が同率で確認されました。単独の第一防衛とはしていません。`;
  if (defense.primary) {
    const limited = defense.opportunityLimited.includes(defense.primary);
    return limited
      ? `今回回答できた場面では、${DEFENSE_LABELS[defense.primary]}反応が比較的多く選ばれました。出現機会が限られるため、場面限定の結果です。`
      : `${qualifierFor(input, "defense")}第一防衛として、${DEFENSE_LABELS[defense.primary]}反応が単独で多く確認されました。`;
  }
  const observed = defense.observedReactions[0];
  return observed
    ? `今回回答した特定場面では、${DEFENSE_LABELS[observed.category]}反応が選ばれました。安定した第一防衛を示す証拠はまだ十分ではありません。`
    : "今回確認できた範囲では、安定した第一防衛を一つに絞る証拠は十分ではありません。";
}

function utilizationText(input: ReportInput, detailed: boolean): string {
  const utilization = input.result.utilization;
  if (!detailed) return `${qualifierFor(input, "utilization")}気づきは${utilization.awarenessBand}、活かせている実感は${utilization.utilizationBand}の帯でした。`;
  return `${qualifierFor(input, "utilization")}気づけている実感は${utilization.awareness.toFixed(1)}、活かせている実感は${utilization.utilization.toFixed(1)}で、段差は${utilization.gap.toFixed(1)}です。確認状態は${utilization.confirmationStatus}です。`;
}

function anchorId(anchors: PersonalizationAnchor[], kind: PersonalizationAnchor["kind"]): string[] {
  return anchors.filter((anchor) => anchor.kind === kind).slice(0, 1).map((anchor) => anchor.id);
}

function notificationBlock(input: ReportInput): DiagnosisBlock {
  if (input.result.gap.pattern !== "small") return "gap";
  if (input.result.defense.observedReactions.length) return "defense";
  return "utilization";
}

export function generateFreeReport(input: ReportInput): FreeReport {
  validateReportInput(input);
  const type = primaryType(input);
  const template = TYPE_REPORT_TEMPLATES[type];
  const allAnchors = buildAnchors(input);
  const anchors = allAnchors.slice(0, input.freeAnchorLimit ?? 2);
  const notification = notificationBlock(input);
  const notificationText = notification === "gap" ? gapText(input, false) : notification === "defense" ? defenseText(input) : utilizationText(input, false);
  const notificationSources = sourceFor(input, notification);
  const route = reportRoute(input);
  const lowSummary = input.result.resolution.kind === "low-confidence"
    ? `今回の回答では、${input.result.resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join("と")}の両方が候補に残りました。場面による切り替わりを含む結果です。`
    : template.core;
  const reportSections = [
    section("headline", [paragraph(input, "free-headline", route === "resolved" ? template.headline : "二つの欲求が場面によって前に出る結果", "type", "inferred", sourceFor(input, "type"))]),
    section("core_desire", [paragraph(input, "free-core", lowSummary, "type", "derived", sourceFor(input, "type"))]),
    section("expression", [paragraph(input, "free-expression", `${qualifierFor(input, "expression")}${EXPRESSION_COPY[input.result.expression.pattern]}`, "expression", "derived", sourceFor(input, "expression"))]),
    section("observation", [
      paragraph(input, "free-notification", notificationText, notification, "derived", notificationSources, anchors.flatMap((anchor) => anchor.sourceQuestionIds.some((id) => notificationSources.includes(id)) ? [anchor.id] : [])),
      paragraph(input, "free-paid-guide", "詳細版では、最大差の場面、負荷時の反応、気づきと活用の段差を別々に確認できます。", "gap", "inferred", sourceFor(input, "gap")),
    ]),
    section("disclaimer", [paragraph(input, "free-disclaimer", "この結果は回答時点の傾向を整理するもので、医療行為や人格全体の判定ではありません。", "type", "possibility", sourceFor(input, "type"))]),
  ];
  return { kind: "free", route, label: labelFor(input), subtitle: route === "resolved" ? resolvedSubtitle(type) : "上位候補が場面によって切り替わる可能性", summary: lowSummary, anchors, sections: reportSections, metadata: metadata(input) };
}

function actionProposal(input: ReportInput): ActionProposal {
  const type = primaryType(input);
  const sources = input.result.gap.maxGapPair
    ? [input.result.gap.maxGapPair.innerQuestionId, input.result.gap.maxGapPair.publicQuestionId]
    : sourceFor(input, "utilization");
  if (input.result.resolution.kind === "low-confidence") return {
    id: "one-week-action",
    text: "次に選択で迷った場面で、先に守りたいものを一語で記録してから行動を選んでください。",
    targetSignal: "candidate_switch_condition",
    sourceQuestionIds: sources,
    expectedObservation: "どちらの候補に近い欲求が、どの場面で先に出たかを観察してください。",
  };
  return { id: "one-week-action", text: TYPE_REPORT_TEMPLATES[type].action, targetSignal: input.result.gap.pattern === "small" ? "utilization" : `gap:${input.result.gap.pattern}`, sourceQuestionIds: sources, expectedObservation: TYPE_REPORT_TEMPLATES[type].observation };
}

function resolvedPaidSections(input: ReportInput, anchors: PersonalizationAnchor[], action: ActionProposal): ReportSection[] {
  const type = primaryType(input);
  const template = TYPE_REPORT_TEMPLATES[type];
  const gapIds = input.result.gap.maxGapPair ? [input.result.gap.maxGapPair.innerQuestionId, input.result.gap.maxGapPair.publicQuestionId] : sourceFor(input, "gap");
  const sub = input.result.resolution.kind === "resolved" && input.result.resolution.secondary ? `サブ傾向として${TYPE_LABELS[input.result.resolution.secondary]}が単独2位にあります。` : "単独2位の条件を満たすサブ傾向は表示していません。";
  const fit = input.result.typeFit.incompatible
    ? "タイプ適合には複数信号による注意が出ているため、ラベルは回答時点の仮説として読んでください。"
    : "タイプ適合では、単一信号だけによる不適合判定は出ていません。";
  return [
    section("headline", [paragraph(input, "paid-headline", template.headline, "type", "inferred", sourceFor(input, "type"))]),
    section("core_desire", [paragraph(input, "paid-core", `${qualifierFor(input, "type")}${template.core} ${sub} ${fit}`, "type", "derived", sourceFor(input, "type"), anchorId(anchors, "answer"), "general", { ...input.result.baseTypeScores, typeFitIncompatible: input.result.typeFit.incompatible })]),
    section("expression", [paragraph(input, "paid-expression", `${qualifierFor(input, "expression")}${EXPRESSION_COPY[input.result.expression.pattern]} 確認状態は${input.result.expression.confirmationStatus}です。`, "expression", "derived", sourceFor(input, "expression"), anchorId(anchors, "confirmation"), "general", { rawScore: input.result.expression.rawScore, confirmationStatus: input.result.expression.confirmationStatus })]),
    section("strengths", [paragraph(input, "paid-strength", template.strength, "type", "inferred", sourceFor(input, "type"))]),
    section("friction", [paragraph(input, "paid-friction", `${template.friction} 最大差の回答場面を観察すると、起点を具体化できます。`, "gap", "inferred", gapIds, anchorId(anchors, "gap_pair"))]),
    section("gap", [paragraph(input, "paid-gap", gapText(input, true), "gap", "derived", gapIds, anchorId(anchors, "gap_pair"), "general", { magnitude: input.result.gap.magnitude, breadth: input.result.gap.breadth, direction: input.result.gap.direction })]),
    section("defense", [
      paragraph(input, "paid-defense", defenseText(input), "defense", input.result.defense.primary || input.result.defense.primaryTied.length ? "derived" : "direct", sourceFor(input, "defense"), anchorId(anchors, "observed_reaction")),
      paragraph(input, "paid-observed-reaction", "第一防衛の安定性とは別に、今回選ばれた反応は回答参照として保持しています。", "defense", "direct", sourceFor(input, "defense"), anchorId(anchors, "observed_reaction"), "specific_answer"),
    ]),
    section("utilization", [paragraph(input, "paid-utilization", utilizationText(input, true), "utilization", "derived", sourceFor(input, "utilization"), anchorId(anchors, "utilization"), "general", { awareness: input.result.utilization.awareness, utilization: input.result.utilization.utilization, gap: input.result.utilization.gap })]),
    section("relationships", [paragraph(input, "paid-relationships", "関係場面では、相手への配慮と自分が大切にしたいことの出し方が重なる可能性があります。実際の行動を断定するものではありません。", "expression", "possibility", sourceFor(input, "expression"), [], "relationship_possibility")]),
    section("work", [paragraph(input, "paid-work", "仕事場面では、判断の速さと周囲へ共有する順序を調整する余地があるかもしれません。領域別行動は未測定です。", "type", "possibility", sourceFor(input, "type"), [], "work_possibility")]),
    section("action", [paragraph(input, "paid-action", `${action.text} 1週間以内に一度試せる観察行動です。`, "gap", "inferred", action.sourceQuestionIds, anchorId(anchors, "gap_pair"))]),
    section("observation", [paragraph(input, "paid-observation", action.expectedObservation, "utilization", "inferred", sourceFor(input, "utilization"))]),
    section("disclaimer", [paragraph(input, "paid-disclaimer", "このレポートは回答時点の選択を整理した非医療的な情報です。形成原因、現実の成果、他者の感情や将来を確定するものではありません。", "type", "possibility", sourceFor(input, "type"))]),
  ];
}

function lowPaidSections(input: ReportInput, anchors: PersonalizationAnchor[], action: ActionProposal): ReportSection[] {
  const candidates = input.result.resolution.kind === "low-confidence" ? input.result.resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join(" と ") : labelFor(input);
  const gapIds = input.result.gap.maxGapPair ? [input.result.gap.maxGapPair.innerQuestionId, input.result.gap.maxGapPair.publicQuestionId] : sourceFor(input, "gap");
  return [
    section("headline", [paragraph(input, "low-headline", `${candidates}が上位候補として残る結果です。`, "type", "derived", sourceFor(input, "type"))]),
    section("core_desire", [paragraph(input, "low-core", "回答場面によって二つの欲求が切り替わること自体を、今回の結果として扱います。診断の失敗ではありません。上位候補の差が単独確定条件に届かなかった経路も、結果の幅として保持しています。", "type", "derived", sourceFor(input, "type"), [], "general", { routeReason: input.route.transitionHistory.at(-1)?.reason ?? "low_confidence" })]),
    section("expression", [paragraph(input, "low-expression", `${qualifierFor(input, "expression")}${EXPRESSION_COPY[input.result.expression.pattern]}`, "expression", "derived", sourceFor(input, "expression"), anchorId(anchors, "confirmation"))]),
    section("gap", [paragraph(input, "low-gap", gapText(input, true), "gap", "derived", gapIds, anchorId(anchors, "gap_pair"))]),
    section("defense", [paragraph(input, "low-defense", defenseText(input), "defense", "direct", sourceFor(input, "defense"), anchorId(anchors, "observed_reaction"))]),
    section("utilization", [paragraph(input, "low-utilization", `${utilizationText(input, true)} 上位候補ごとの回答を今後の比較材料にできます。`, "utilization", "derived", sourceFor(input, "utilization"), anchorId(anchors, "utilization"))]),
    section("action", [paragraph(input, "low-action", `${action.text} どちらの欲求が前に出たかも一緒に記録してください。`, "gap", "inferred", action.sourceQuestionIds, anchorId(anchors, "gap_pair"))]),
    section("disclaimer", [paragraph(input, "low-disclaimer", "上位候補を無理に一つへ決めず、回答時点の幅として示しています。必要に応じて再回答できる構造です。医療行為ではありません。", "type", "possibility", sourceFor(input, "type"))]),
  ];
}

export function generatePaidReport(input: ReportInput, freeReport?: FreeReport): PaidReport {
  validateReportInput(input);
  const anchors = buildAnchors(input);
  const references = buildAnswerReferences(input.answers, input.questions);
  const action = actionProposal(input);
  const route = reportRoute(input);
  const type = primaryType(input);
  const draft: PaidReport = {
    kind: "paid",
    route,
    label: labelFor(input),
    subtitle: route === "resolved" ? resolvedSubtitle(type) : "上位候補が切り替わる条件を観察するレポート",
    anchors,
    sections: route === "resolved" ? resolvedPaidSections(input, anchors, action) : lowPaidSections(input, anchors, action),
    answerReferences: references,
    actionProposals: [action],
    qualityGate: { passed: true, issues: [] },
    metadata: metadata(input),
  };
  const quality = validatePaidReport(draft, freeReport ?? generateFreeReport(input));
  if (!quality.passed) throw new PaidReportQualityError(quality.issues);
  draft.qualityGate = quality;
  return draft;
}

export function resultLabel(input: { resolution: ReportInput["result"]["resolution"]; expression: ReportInput["result"]["expression"] }): string {
  return input.resolution.kind === "resolved"
    ? resolvedLabel(input.resolution.primary, input.expression.pattern)
    : input.resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join(" × ");
}
