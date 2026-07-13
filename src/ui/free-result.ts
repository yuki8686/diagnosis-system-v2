import { TYPE_LABELS } from "../constants";
import type { Confidence, FreeGapState, FreeReport, FreeReportDisplayItem, ReportSectionId, TypeResolution } from "../types";

export interface VisibleFreeReportSection {
  id: ReportSectionId;
  title: string;
  paragraphs: string[];
}

export interface ResultStatusBanner {
  tone: "low" | "tie";
  title: string;
  body: string;
}

export interface VisibleFreeReportDetailItem {
  id: string;
  text: string;
}

export interface PublicSelfViewModel {
  traits: VisibleFreeReportDetailItem[];
  misunderstanding?: VisibleFreeReportDetailItem;
}

export interface PrivateSelfViewModel {
  paragraphs: VisibleFreeReportDetailItem[];
}

export interface GapViewModel {
  stateLabel?: string;
  paragraphs: VisibleFreeReportDetailItem[];
  lockedItems: Array<{ title: string; hint: string }>;
}

export interface ConditionsViewModel {
  energizing: VisibleFreeReportDetailItem[];
  blocking: VisibleFreeReportDetailItem[];
}

export type ResultChapterKey = "core" | "expression" | "public-self" | "private-self" | "gap" | "condition" | "observation";

export interface NumberedResultChapter {
  key: ResultChapterKey;
  chapter: string;
}

const bodySectionIds = ["core_desire", "expression", "observation"] as const;
const lockedGapItems = [
  { title: "ズレが強く出やすい場面", hint: "詳細レポートで表示" },
  { title: "無意識に取りやすい防衛反応", hint: "詳細レポートで表示" },
] as const;
const resultChapterLabels: Record<ResultChapterKey, string> = {
  core: "CORE",
  expression: "EXPRESSION",
  "public-self": "PUBLIC SELF",
  "private-self": "PRIVATE SELF",
  gap: "GAP",
  condition: "CONDITION",
  observation: "OBSERVATION",
};

export function confidenceLabel(confidence: Confidence): string {
  const label: Record<Confidence, string> = {
    high: "高い",
    medium: "中程度",
    low: "参考",
  };
  return `判定の確からしさ：${label[confidence]}`;
}

export function visibleFreeReportSection(report: FreeReport, id: ReportSectionId): VisibleFreeReportSection | undefined {
  const section = report.sections.find((item) => item.id === id);
  return section ? { id: section.id, title: section.title, paragraphs: section.paragraphs.map((paragraph) => paragraph.text) } : undefined;
}

export function visibleFreeReportSections(report: FreeReport, options: { includeExpression?: boolean } = {}): VisibleFreeReportSection[] {
  const includeExpression = options.includeExpression ?? true;
  return bodySectionIds.flatMap((id) => {
    if (id === "expression" && !includeExpression) return [];
    const section = visibleFreeReportSection(report, id);
    return section ? [section] : [];
  });
}

export function numberedResultChapters(keys: readonly ResultChapterKey[]): NumberedResultChapter[] {
  return keys.map((key, index) => ({
    key,
    chapter: `${String(index + 1).padStart(2, "0")} / ${resultChapterLabels[key]}`,
  }));
}

function visibleDetailItem(item: FreeReportDisplayItem | undefined): VisibleFreeReportDetailItem | undefined {
  if (!item || !item.id || !item.text.trim()) return undefined;
  return { id: item.id, text: item.text };
}

function visibleDetailItems(items: readonly FreeReportDisplayItem[] | undefined): VisibleFreeReportDetailItem[] {
  return (items ?? []).flatMap((item) => {
    const visible = visibleDetailItem(item);
    return visible ? [visible] : [];
  });
}

export function publicSelfViewModel(report: FreeReport): PublicSelfViewModel | undefined {
  const publicSelf = report.details?.publicSelf;
  if (!publicSelf) return undefined;

  const traits = visibleDetailItems(publicSelf.traits);
  if (traits.length === 0) return undefined;
  return {
    traits,
    misunderstanding: visibleDetailItem(publicSelf.misunderstanding),
  };
}

export function privateSelfViewModel(report: FreeReport): PrivateSelfViewModel | undefined {
  const privateSelf = report.details?.privateSelf;
  if (!privateSelf) return undefined;

  const paragraphs = visibleDetailItems(privateSelf.paragraphs);
  return paragraphs.length > 0 ? { paragraphs } : undefined;
}

export function gapStateLabel(state: FreeGapState): string {
  const labels: Record<FreeGapState, string> = {
    aligned: "内側と対人場面の回答は比較的近い",
    light: "小さなズレが見られる",
    medium: "ある程度のズレが見られる",
    strong: "はっきりしたズレが見られる",
    mixed: "場面によって方向が入れ替わる",
    unclear: "一方向にはまとめにくい",
  };
  return labels[state];
}

export function gapViewModel(report: FreeReport): GapViewModel {
  const gap = report.details?.gap;
  return {
    stateLabel: gap ? gapStateLabel(gap.state) : undefined,
    paragraphs: visibleDetailItems(gap?.paragraphs),
    lockedItems: lockedGapItems.map((item) => ({ ...item })),
  };
}

export function conditionsViewModel(report: FreeReport): ConditionsViewModel | undefined {
  const conditions = report.details?.conditions;
  if (!conditions) return undefined;

  const energizing = visibleDetailItems(conditions.energizing);
  const blocking = visibleDetailItems(conditions.blocking);
  return energizing.length > 0 || blocking.length > 0 ? { energizing, blocking } : undefined;
}

export function resultStatusBanner(report: FreeReport, resolution?: TypeResolution): ResultStatusBanner | undefined {
  if (report.route === "low_confidence" && resolution?.kind === "low-confidence") {
    return {
      tone: "low",
      title: "今回は、判定を参考として見てください",
      body: "上位候補が近いため、タイプ名を一つに決めず、現在強く表れている傾向として表示しています。",
    };
  }
  if (report.route === "resolved" && resolution?.kind === "resolved" && resolution.source === "comparison" && resolution.secondary) {
    return {
      tone: "tie",
      title: "2つのタイプが近い結果でした",
      body: "最も強かったタイプを中心に表示していますが、場面によって次点タイプの特徴も使い分けている可能性があります。",
    };
  }
  return undefined;
}

export function secondaryTypeNote(report: FreeReport, resolution?: TypeResolution): string | undefined {
  if (report.route === "low_confidence" && resolution?.kind === "low-confidence") {
    return `候補タイプ：${resolution.candidates.map((typeId) => TYPE_LABELS[typeId]).join("・")}`;
  }
  if (report.route === "resolved" && resolution?.kind === "resolved" && resolution.secondary) {
    const prefix = resolution.source === "comparison" ? "次点候補" : "次点タイプ";
    return `${prefix}：${TYPE_LABELS[resolution.secondary]}`;
  }
  return undefined;
}
