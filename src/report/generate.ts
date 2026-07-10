import { DEFENSE_LABELS, TYPE_LABELS } from "../constants";
import type {
  ActionProposal, AnswerReference, DefenseCategory, DefenseClaimKind, DiagnosisBlock, FreeReport,
  PaidReport, PersonalizationAnchor, ReportInput, ReportLayer, ReportMetadata, ReportParagraph,
  ReportRoute, ReportScenarioScope, ReportSection, ReportSectionId, TypeId,
} from "../types";
import { buildAnchors, buildAnswerReferences } from "./anchors";
import { evidenceFor } from "./evidence";
import { PaidReportQualityError, validatePaidReport } from "./quality";
import { labelTemplate, resolvedLabel, resolvedSubtitle } from "./templates/labels";
import {
  breadthText, CONFIRMATION_STATUS_TEXT, confidenceSentence, GAP_DIRECTION_TEXT, GAP_PATTERN_TEXT,
  gapStrengthText, UTILIZATION_BAND_TEXT, UTILIZATION_USE_BAND_TEXT, utilizationGapText,
} from "./templates/presentation";

const TITLES: Record<ReportSectionId, string> = {
  headline: "診断結果の全体像", core_desire: "大切にしやすいもの", expression: "欲望の出し方",
  gap: "本音側と対人側の差", defense: "負荷がかかった場面の反応", utilization: "気づきと使いこなし",
  strengths: "周囲から見える力", friction: "誤解とつまずき", relationships: "関係場面での可能性",
  work: "仕事場面での可能性", action: "次に試すこと", observation: "観察ポイント", disclaimer: "この結果の読み方",
};

const layerFor = (block: DiagnosisBlock): ReportLayer => block === "type" ? "type" : block === "expression" ? "expression" : block === "gap" ? "gap" : "defense_utilization";

function validateReportInput(input: ReportInput): void {
  const expectedRoute = input.result.resolution.kind === "resolved" ? "resolved" : "low-confidence";
  if (input.result.route !== expectedRoute || input.route.route !== expectedRoute) throw new Error("Report input route and type resolution are inconsistent");
  if (JSON.stringify(input.result.resolution) !== JSON.stringify(input.route.typeResolution)) throw new Error("Report input result and routing type resolutions differ");
  const references = buildAnswerReferences(input.answers, input.questions);
  const ids = new Set(references.map((reference) => reference.questionId));
  for (const id of input.result.answeredQuestionIds) if (!ids.has(id)) throw new Error(`Report input is missing a result answer: ${id}`);
  for (const id of input.route.answeredQuestionIds) if (!ids.has(id)) throw new Error(`Report input is missing a route answer: ${id}`);
}

function metadata(input: ReportInput): ReportMetadata {
  const versions = ["questionBankVersion", "scoringVersion", "engineVersion", "reportTemplateVersion"] as const;
  for (const key of versions) if (!input.result.metadata[key] || input.result.metadata[key] !== input.route[key]) throw new Error(`Report version mismatch or missing: ${key}`);
  return {
    sessionId: input.route.sessionId,
    questionBankVersion: input.result.metadata.questionBankVersion,
    scoringVersion: input.result.metadata.scoringVersion,
    engineVersion: input.result.metadata.engineVersion,
    reportTemplateVersion: input.result.metadata.reportTemplateVersion,
    typeConfidence: input.result.confidence.type,
    expressionConfidence: input.result.confidence.expression,
    gapConfidence: input.result.confidence.gap,
    defenseConfidence: input.result.confidence.defense,
    utilizationConfidence: input.result.confidence.utilization,
  };
}

function reportRoute(input: ReportInput): ReportRoute { return input.result.resolution.kind === "resolved" ? "resolved" : "low_confidence"; }
function primaryType(input: ReportInput): TypeId { return input.result.resolution.kind === "resolved" ? input.result.resolution.primary : input.result.resolution.candidates[0]; }
function labelFor(input: ReportInput): string {
  return input.result.resolution.kind === "resolved"
    ? resolvedLabel(input.result.resolution.primary, input.result.expression.pattern)
    : input.result.resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join(" × ");
}

function sourceFor(input: ReportInput, block: DiagnosisBlock): string[] {
  let candidates: string[];
  if (block === "type") candidates = input.result.answeredQuestionIds.filter((id) => input.questions.some((q) => q.id === id && (q.block === "common-type" || q.block === "type-comparison")));
  else if (block === "expression") candidates = input.result.expression.usedQuestionIds;
  else if (block === "gap") candidates = input.result.gap.usedQuestionIds;
  else if (block === "defense") candidates = input.result.defense.usedQuestionIds;
  else candidates = input.result.utilization.usedQuestionIds;
  const answerIds = new Set(input.answers.map((answer) => answer.questionId));
  const ids = [...new Set(candidates)].filter((id) => answerIds.has(id) && input.questions.some((q) => q.id === id));
  if (!ids.length) throw new Error(`Report ${block} sourceQuestionIds are missing`);
  return ids;
}

function paragraph(
  input: ReportInput, id: string, text: string, block: DiagnosisBlock,
  level: "direct" | "derived" | "inferred" | "possibility", sourceIds: string[],
  options: { anchorIds?: string[]; scope?: ReportScenarioScope; scores?: Record<string, number | string | boolean>; layer?: ReportLayer; claimKind?: DefenseClaimKind; claimCategory?: DefenseCategory } = {},
): ReportParagraph {
  return {
    id, text,
    evidence: evidenceFor(input, block, level, sourceIds, options.scope ?? "general", options.scores),
    anchorIds: options.anchorIds ?? [], layer: options.layer ?? layerFor(block),
    claimKind: options.claimKind, claimCategory: options.claimCategory,
  };
}

function section(id: ReportSectionId, paragraphs: ReportParagraph[]): ReportSection { return { id, title: TITLES[id], paragraphs }; }
function anchorIds(anchors: PersonalizationAnchor[], kind: PersonalizationAnchor["kind"]): string[] { return anchors.filter((anchor) => anchor.kind === kind).slice(0, 1).map((anchor) => anchor.id); }

function compact(text: string, limit = 42): string {
  const normalized = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/[?？]$/, "").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function calibrated(input: ReportInput, block: DiagnosisBlock, text: string): string {
  const confidence = input.result.confidence[block];
  if (confidence === "high") return text;
  const moderate = text
    .replace(/傾向があります。$/, "傾向が比較的見られました。")
    .replace(/出し方です。$/, "出し方が比較的見られました。")
    .replace(/人です。$/, "特徴が比較的見られました。")
    .replace(/強みです。$/, "強みとして表れやすいでしょう。")
    .replace(/ことがあります。$/, "ことが比較的多く見られました。");
  const soft = text
    .replace(/傾向があります。$/, "傾向が場面によって表れる可能性があります。")
    .replace(/出し方です。$/, "出し方になる可能性があります。")
    .replace(/人です。$/, "特徴が場面によって表れる可能性があります。")
    .replace(/強みです。$/, "強みとして表れる可能性があります。")
    .replace(/ことがあります。$/, "ことが場面によって起こる可能性があります。");
  return confidence === "medium" ? `今回の回答では、${moderate}` : `今回確認できた範囲では、${soft}`;
}

function answerMeaning(reference: AnswerReference): string {
  if (reference.numericValue != null) return ({ 1: "ほとんど当てはまらない", 2: "あまり当てはまらない", 3: "どちらとも言い切れない", 4: "やや当てはまる", 5: "よく当てはまる" } as Record<number, string>)[reference.numericValue] ?? "回答を選んだ";
  return compact(reference.selectedOptionText, 36);
}

function references(input: ReportInput): AnswerReference[] { return buildAnswerReferences(input.answers, input.questions); }
function referenceMap(input: ReportInput): Map<string, AnswerReference> { return new Map(references(input).map((reference) => [reference.questionId, reference])); }
function typeReference(input: ReportInput): AnswerReference {
  const comparison = references(input).find((reference) => input.questions.find((q) => q.id === reference.questionId)?.block === "type-comparison");
  const common = references(input).find((reference) => input.questions.find((q) => q.id === reference.questionId)?.block === "common-type");
  if (!comparison && !common) throw new Error("Report type answer reference is missing");
  return comparison ?? common!;
}

function answerPunch(reference: AnswerReference, protects?: string): string {
  const protectedFocus = protects?.replace(/を守ろうとしやすい人です。$/, "") ?? "その選択で大切にしたもの";
  return `たとえば、あなたは「${compact(reference.prompt)}」という場面で「${answerMeaning(reference)}」を選んでいます。結果だけでなく、${protectedFocus}も同時に守ろうとする自分に覚えはありませんか。`;
}

function gapCopy(input: ReportInput): string {
  const gap = input.result.gap;
  return confidenceSentence(
    input.result.confidence.gap,
    `${GAP_PATTERN_TEXT[gap.pattern]}が見られます。${GAP_DIRECTION_TEXT[gap.direction]}で、${gapStrengthText(gap.strength)}が${breadthText(gap.breadth)}。`,
    `今回の回答では、${GAP_PATTERN_TEXT[gap.pattern]}が比較的見られました。${GAP_DIRECTION_TEXT[gap.direction]}として、${gapStrengthText(gap.strength)}が${breadthText(gap.breadth)}。`,
    `今回確認できた範囲では、${GAP_PATTERN_TEXT[gap.pattern]}が場面によって表れる可能性があります。${breadthText(gap.breadth)}。`,
  );
}

function maxGapParagraph(input: ReportInput, anchors: PersonalizationAnchor[]): ReportParagraph {
  const pair = input.result.gap.maxGapPair;
  if (!pair) throw new Error("Paid report requires maxGapPair");
  const map = referenceMap(input);
  const inner = map.get(pair.innerQuestionId);
  const publicAnswer = map.get(pair.publicQuestionId);
  if (!inner || !publicAnswer) throw new Error("Maximum gap answer references are missing");
  const scene = compact(inner.prompt.replace(/^本音では[、,]?/, ""), 38);
  const text = `最大差は「${scene}」に関する場面です。本音側では「${answerMeaning(inner)}」、対人側では「${answerMeaning(publicAnswer)}」を選んでいます。${GAP_DIRECTION_TEXT[input.result.gap.direction]}に${gapStrengthText(input.result.gap.strength)}があり、${breadthText(input.result.gap.breadth)}。`;
  return paragraph(input, "paid-max-gap-answer", text, "gap", "direct", [inner.questionId, publicAnswer.questionId], { anchorIds: anchorIds(anchors, "gap_pair"), layer: "personalization", scores: { pairId: pair.pairId, diff: pair.diff } });
}

function defenseClaims(input: ReportInput, anchors: PersonalizationAnchor[]): ReportParagraph[] {
  const defense = input.result.defense;
  const sources = sourceFor(input, "defense");
  const result: ReportParagraph[] = [];
  if (defense.primaryTied.length >= 2) {
    const labels = defense.primaryTied.map((id) => `「${DEFENSE_LABELS[id]}」`);
    result.push(paragraph(input, "paid-defense-tie", `${labels.slice(0, -1).join("、")}と${labels.at(-1)}が、同じ程度に確認されています。どちらか一つを第一防衛とはしていません。`, "defense", "derived", sources, { claimKind: "defense_tie" }));
  } else if (defense.primary) {
    const limited = defense.opportunityLimited.includes(defense.primary);
    const primaryText = limited
      ? `「${DEFENSE_LABELS[defense.primary]}」反応は、回答できる場面が限られているため、今回の場面に限った反応として扱います。`
      : confidenceSentence(
          defense.confidence,
          `第一防衛として「${DEFENSE_LABELS[defense.primary]}」反応が、複数の回答場面で単独首位になりました。`,
          `今回の回答では「${DEFENSE_LABELS[defense.primary]}」反応が比較的多く、第一防衛として扱います。今後の場面で再確認できる余地があります。`,
          `今回確認できた範囲では「${DEFENSE_LABELS[defense.primary]}」反応が出る可能性がありますが、安定した第一防衛とはしていません。`,
        );
    result.push(paragraph(input, "paid-primary-defense", primaryText, "defense", "derived", sources, { claimKind: limited ? "scenario_limited" : "primary_defense", claimCategory: defense.primary }));
  } else {
    result.push(paragraph(input, "paid-defense-limited", "今回確認できた範囲では、安定した第一防衛を一つに絞る証拠は十分ではありません。", "defense", "derived", sources, { claimKind: "scenario_limited" }));
  }
  const observed = defense.observedReactions[0];
  if (observed) {
    const ref = referenceMap(input).get(observed.questionId);
    if (!ref) throw new Error(`Observed defense answer reference is missing: ${observed.questionId}`);
    const limited = defense.opportunityLimited.includes(observed.category);
    result.push(paragraph(input, "paid-observed-reaction", `一方、今回の「${compact(ref.prompt, 36)}」という場面では「${answerMeaning(ref)}」を選んでいます。これは第一防衛の安定性とは分けて、${limited ? "この場面に限った反応" : "今回確認された反応"}として扱います。`, "defense", "direct", [ref.questionId], { anchorIds: anchorIds(anchors, "observed_reaction"), layer: "personalization", claimKind: limited ? "scenario_limited" : "observed_reaction", claimCategory: observed.category }));
  }
  return result;
}

function utilizationParagraphs(input: ReportInput, anchors: PersonalizationAnchor[]): ReportParagraph[] {
  const utilization = input.result.utilization;
  const sources = sourceFor(input, "utilization");
  const ref = referenceMap(input).get(sources[0]);
  const awarenessText = confidenceSentence(
    input.result.confidence.utilization,
    `気づけている実感については、${UTILIZATION_BAND_TEXT[utilization.awarenessBand]}という回答のまとまりです。`,
    `今回の回答では、気づけている実感について、${UTILIZATION_BAND_TEXT[utilization.awarenessBand]}傾向が比較的見られました。`,
    `今回確認できた範囲では、気づけている実感について、${UTILIZATION_BAND_TEXT[utilization.awarenessBand]}可能性があります。`,
  );
  const useText = confidenceSentence(
    input.result.confidence.utilization,
    `活かせている実感については、${UTILIZATION_USE_BAND_TEXT[utilization.utilizationBand]}状態です。${utilizationGapText(utilization.gap)}。`,
    `今回の回答では、活かせている実感について、${UTILIZATION_USE_BAND_TEXT[utilization.utilizationBand]}傾向が比較的見られました。${utilizationGapText(utilization.gap)}。`,
    `今回確認できた範囲では、活かせている実感について、${UTILIZATION_USE_BAND_TEXT[utilization.utilizationBand]}可能性があります。${utilizationGapText(utilization.gap)}。`,
  );
  return [
    paragraph(input, "paid-awareness", awarenessText, "utilization", "derived", sources, { scores: { awareness: utilization.awareness, awarenessBand: utilization.awarenessBand } }),
    paragraph(input, "paid-utilization", useText, "utilization", "derived", sources, { anchorIds: anchorIds(anchors, "utilization"), scores: { utilization: utilization.utilization, utilizationBand: utilization.utilizationBand, gap: utilization.gap, confirmationStatus: utilization.confirmationStatus } }),
    ...(ref ? [paragraph(input, "paid-utilization-answer", `実際に「${compact(ref.prompt, 36)}」という項目では「${answerMeaning(ref)}」を選んでいます。`, "utilization", "direct", [ref.questionId], { layer: "personalization" })] : []),
  ];
}

type FreeHook = { id: string; block: DiagnosisBlock; text: string; sources: string[] };
function freeHook(input: ReportInput, template: ReturnType<typeof labelTemplate>): FreeHook {
  if (input.result.gap.pattern !== "small" && input.result.gap.pattern !== "unclear") return { id: "free-hook-gap", block: "gap", text: gapCopy(input), sources: sourceFor(input, "gap") };
  if (input.result.defense.confidence !== "low") {
    const defense = input.result.defense;
    const name = defense.primary ? `「${DEFENSE_LABELS[defense.primary]}」` : defense.primaryTied.map((id) => `「${DEFENSE_LABELS[id]}」`).join("と");
    return { id: "free-hook-defense", block: "defense", text: `${name || "複数の反応"}が負荷時の回答で比較的多く見られました。詳細版では、第一防衛と今回だけの反応を分けて確認します。`, sources: sourceFor(input, "defense") };
  }
  if (Math.abs(input.result.utilization.gap) >= 0.5) return { id: "free-hook-utilization", block: "utilization", text: utilizationGapText(input.result.utilization.gap), sources: sourceFor(input, "utilization") };
  return { id: "free-hook-strength", block: "type", text: `${template.strength} 詳細版では、この力が再現しやすい条件を確認します。`, sources: sourceFor(input, "type") };
}

export function generateFreeReport(input: ReportInput): FreeReport {
  validateReportInput(input);
  const type = primaryType(input);
  const template = labelTemplate(type, input.result.expression.pattern);
  const anchors = buildAnchors(input).slice(0, input.freeAnchorLimit ?? 2);
  const typeRef = typeReference(input);
  const hook = freeHook(input, template);
  const route = reportRoute(input);
  const lowCandidates = input.result.resolution.kind === "low-confidence" ? input.result.resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join("と") : "";
  const summary = route === "resolved" ? template.core : `${lowCandidates}の両方が候補に残り、場面によって大切にするものが切り替わる結果です。`;
  const sections = [
    section("headline", [paragraph(input, "free-headline", route === "resolved" ? template.headline : "二つの欲求を、場面に応じて使い分ける結果", "type", "inferred", sourceFor(input, "type"))]),
    section("core_desire", [
      paragraph(input, "free-answer-punch", answerPunch(typeRef, route === "resolved" ? template.protects : undefined), "type", "direct", [typeRef.questionId], { layer: "personalization" }),
      paragraph(input, "free-core", route === "resolved" ? calibrated(input, "type", summary) : summary, "type", "derived", sourceFor(input, "type")),
      paragraph(input, "free-protects", route === "resolved" ? calibrated(input, "type", template.protects) : "どちらか一方だけでなく、結果や関係など複数の大切なものを状況に応じて守ろうとしています。", "type", "inferred", sourceFor(input, "type")),
    ]),
    section("expression", [
      paragraph(input, "free-expression", route === "resolved" ? calibrated(input, "expression", template.expression) : "相手や場面を見ながら、自分の希望を外へ出す量を選び分ける回答が見られます。", "expression", "derived", sourceFor(input, "expression")),
      paragraph(input, "free-impression", route === "resolved" ? template.impression : "場面によって積極的にも慎重にも見られやすい可能性があります。", "expression", "inferred", sourceFor(input, "expression")),
    ]),
    section("observation", [
      paragraph(input, hook.id, hook.text, hook.block, "derived", hook.sources),
      paragraph(input, "free-paid-guide", "詳細版では、最大差が出た場面、負荷時の反応、気づきと活用の間を、実際の回答と結びつけて確認できます。", "gap", "inferred", sourceFor(input, "gap")),
    ]),
    section("disclaimer", [paragraph(input, "free-disclaimer", "この結果は回答時点の傾向を整理するもので、医療行為や人格全体の判定ではありません。", "type", "possibility", sourceFor(input, "type"))]),
  ];
  return { kind: "free", route, label: labelFor(input), subtitle: route === "resolved" ? resolvedSubtitle(type) : "上位候補が切り替わる条件を観察する結果", summary, anchors, sections, metadata: metadata(input) };
}

function actionProposal(input: ReportInput): ActionProposal {
  const type = primaryType(input);
  const template = labelTemplate(type, input.result.expression.pattern);
  const sources = input.result.gap.maxGapPair ? [input.result.gap.maxGapPair.innerQuestionId, input.result.gap.maxGapPair.publicQuestionId] : sourceFor(input, "utilization");
  return input.result.resolution.kind === "low-confidence"
    ? { id: "one-week-action", text: "次に選択で迷った場面で、先に守りたいものを一語で記録してから行動を選んでください。", targetSignal: "candidate-switch", sourceQuestionIds: sources, expectedObservation: "どちらの候補に近い欲求が、どの場面で先に出たかを観察してください。" }
    : { id: "one-week-action", text: template.action, targetSignal: "report-pattern", sourceQuestionIds: sources, expectedObservation: template.observation };
}

function resolvedPaidSections(input: ReportInput, anchors: PersonalizationAnchor[], action: ActionProposal): ReportSection[] {
  const type = primaryType(input);
  const template = labelTemplate(type, input.result.expression.pattern);
  const typeRef = typeReference(input);
  const sub = input.result.resolution.kind === "resolved" && input.result.resolution.secondary ? `サブ傾向として${TYPE_LABELS[input.result.resolution.secondary]}が単独二位にあります。` : "単独二位の条件を満たすサブ傾向は表示していません。";
  return [
    section("headline", [paragraph(input, "paid-headline", template.headline, "type", "inferred", sourceFor(input, "type"))]),
    section("core_desire", [
      paragraph(input, "paid-core", `${calibrated(input, "type", template.core)} ${calibrated(input, "type", template.protects)} ${sub}`, "type", "derived", sourceFor(input, "type"), { scores: { ...input.result.baseTypeScores, typeFitIncompatible: input.result.typeFit.incompatible } }),
      paragraph(input, "paid-type-answer", answerPunch(typeRef, template.protects), "type", "direct", [typeRef.questionId], { layer: "personalization", anchorIds: anchorIds(anchors, "answer") }),
    ]),
    section("expression", [paragraph(input, "paid-expression", `${calibrated(input, "expression", template.expression)} ${CONFIRMATION_STATUS_TEXT[input.result.expression.confirmationStatus]}。`, "expression", "derived", sourceFor(input, "expression"), { anchorIds: anchorIds(anchors, "confirmation"), scores: { rawScore: input.result.expression.rawScore, confirmationStatus: input.result.expression.confirmationStatus } })]),
    section("strengths", [paragraph(input, "paid-impression", template.impression, "expression", "inferred", sourceFor(input, "expression")), paragraph(input, "paid-strength", template.strength, "type", "inferred", sourceFor(input, "type"))]),
    section("friction", [paragraph(input, "paid-misunderstanding", template.misunderstanding, "expression", "inferred", sourceFor(input, "expression")), paragraph(input, "paid-friction", template.friction, "gap", "inferred", sourceFor(input, "gap"))]),
    section("gap", [paragraph(input, "paid-gap-overview", gapCopy(input), "gap", "derived", sourceFor(input, "gap"), { scores: { magnitude: input.result.gap.magnitude, breadth: input.result.gap.breadth, direction: input.result.gap.direction, pattern: input.result.gap.pattern, confirmationStatus: input.result.gap.confirmationStatus } }), maxGapParagraph(input, anchors)]),
    section("defense", defenseClaims(input, anchors)),
    section("utilization", utilizationParagraphs(input, anchors)),
    section("relationships", [paragraph(input, "paid-relationships", `${template.impression.replace(/でしょう。$/, "可能性があります。")} 関係場面では、${GAP_PATTERN_TEXT[input.result.gap.pattern]}が出し方へ影響することも考えられます。実際の関係行動は未測定です。`, "expression", "possibility", [...sourceFor(input, "expression"), ...sourceFor(input, "gap")], { scope: "relationship_possibility" })]),
    section("work", [paragraph(input, "paid-work", `仕事場面では、${template.strength.replace(/です。$/, "ことがあります。")} 一方で、${template.friction} 実際の仕事上の成果は未測定です。`, "type", "possibility", [...sourceFor(input, "type"), ...sourceFor(input, "gap")], { scope: "work_possibility" })]),
    section("action", [paragraph(input, "paid-action", `${action.text} 一週間以内に一度試せる観察行動です。`, "gap", "inferred", action.sourceQuestionIds)]),
    section("observation", [paragraph(input, "paid-observation", `${action.expectedObservation} さらに詳しく見る場合は、切り替わる場面を記録して精密版の材料にできます。`, "utilization", "inferred", sourceFor(input, "utilization"))]),
    section("disclaimer", [paragraph(input, "paid-disclaimer", "このレポートは回答時点の選択を整理した非医療的な情報です。形成原因、現実の成果、他者の感情や将来を確定するものではありません。", "type", "possibility", sourceFor(input, "type"))]),
  ];
}

function lowPaidSections(input: ReportInput, anchors: PersonalizationAnchor[], action: ActionProposal): ReportSection[] {
  if (input.result.resolution.kind !== "low-confidence") throw new Error("Low-confidence report requires candidate resolution");
  const [first, second] = input.result.resolution.candidates;
  const firstTemplate = labelTemplate(first, input.result.expression.pattern);
  const secondTemplate = labelTemplate(second, input.result.expression.pattern);
  const typeRef = typeReference(input);
  return [
    section("headline", [paragraph(input, "low-headline", `${TYPE_LABELS[first]}と${TYPE_LABELS[second]}が上位候補として残る結果です。`, "type", "derived", sourceFor(input, "type"))]),
    section("core_desire", [
      paragraph(input, "low-common", `共通しているのは、${firstTemplate.protects.replace(/人です。$/, "こと")}と、${secondTemplate.protects.replace(/人です。$/, "こと")}をどちらも無視しにくい点です。`, "type", "inferred", sourceFor(input, "type")),
      paragraph(input, "low-difference", `違いは、${TYPE_LABELS[first]}が「${firstTemplate.core}」へ、${TYPE_LABELS[second]}が「${secondTemplate.core}」へ反応しやすい点です。`, "type", "derived", sourceFor(input, "type")),
      paragraph(input, "low-comparison-answer", answerPunch(typeRef), "type", "direct", [typeRef.questionId], { layer: "personalization", anchorIds: anchorIds(anchors, "comparison") }),
    ]),
    section("expression", [paragraph(input, "low-expression", `汎用の出し方回答では、${firstTemplate.expression} 同時に、${secondTemplate.expression} 場面と相手を見て出し方を選ぶ余地があります。`, "expression", "derived", sourceFor(input, "expression"))]),
    section("gap", [paragraph(input, "low-gap", `汎用のズレ回答では、${gapCopy(input)} どの候補が前に出たかと合わせて観察できます。`, "gap", "derived", sourceFor(input, "gap")), maxGapParagraph(input, anchors)]),
    section("defense", defenseClaims(input, anchors)),
    section("utilization", [
      ...utilizationParagraphs(input, anchors),
      paragraph(input, "low-candidate-utilization", `${TYPE_LABELS[first]}と${TYPE_LABELS[second]}に対応する使いこなし回答をまとめると、${UTILIZATION_BAND_TEXT[input.result.utilization.awarenessBand]}一方、${UTILIZATION_USE_BAND_TEXT[input.result.utilization.utilizationBand]}状態です。`, "utilization", "derived", sourceFor(input, "utilization")),
      paragraph(input, "low-switch-condition", `切り替わる条件として、${firstTemplate.friction} また、${secondTemplate.friction} どちらが近かったかを場面ごとに確かめてください。`, "type", "inferred", sourceFor(input, "type")),
    ]),
    section("action", [paragraph(input, "low-action", `${action.text} ${action.expectedObservation}`, "gap", "inferred", action.sourceQuestionIds)]),
    section("disclaimer", [paragraph(input, "low-disclaimer", "上位候補を無理に一つへ決めず、回答時点の幅として示しています。今後の観察後に再回答したり、精密版の材料へつなげたりできます。医療行為ではありません。", "type", "possibility", sourceFor(input, "type"))]),
  ];
}

export function generatePaidReport(input: ReportInput, freeReport?: FreeReport): PaidReport {
  validateReportInput(input);
  const anchors = buildAnchors(input);
  const action = actionProposal(input);
  const route = reportRoute(input);
  const type = primaryType(input);
  const draft: PaidReport = {
    kind: "paid", route, label: labelFor(input),
    subtitle: route === "resolved" ? resolvedSubtitle(type) : "上位候補の共通点と切り替わる条件を観察するレポート",
    anchors, sections: route === "resolved" ? resolvedPaidSections(input, anchors, action) : lowPaidSections(input, anchors, action),
    answerReferences: references(input), actionProposals: [action], qualityGate: { passed: true, issues: [] }, metadata: metadata(input),
    defenseContext: { primary: input.result.defense.primary, primaryTied: input.result.defense.primaryTied, confidence: input.result.defense.confidence, opportunityLimited: input.result.defense.opportunityLimited },
  };
  const quality = validatePaidReport(draft, freeReport ?? generateFreeReport(input));
  if (!quality.passed) throw new PaidReportQualityError(quality.issues);
  draft.qualityGate = quality;
  return draft;
}

export function resultLabel(input: { resolution: ReportInput["result"]["resolution"]; expression: ReportInput["result"]["expression"] }): string {
  return input.resolution.kind === "resolved" ? resolvedLabel(input.resolution.primary, input.expression.pattern) : input.resolution.candidates.slice(0, 2).map((id) => TYPE_LABELS[id]).join(" × ");
}
