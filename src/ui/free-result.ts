import { TYPE_LABELS } from "../constants";
import type { Confidence, FreeReport, ReportSectionId, TypeResolution } from "../types";

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

const bodySectionIds = ["core_desire", "expression", "observation"] as const;

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

export function visibleFreeReportSections(report: FreeReport): VisibleFreeReportSection[] {
  return bodySectionIds.flatMap((id) => {
    const section = visibleFreeReportSection(report, id);
    return section ? [section] : [];
  });
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

export function resultSectionChapter(id: ReportSectionId): string {
  const chapters: Partial<Record<ReportSectionId, string>> = {
    core_desire: "01 / CORE",
    expression: "02 / EXPRESSION",
    observation: "03 / OBSERVATION",
  };
  return chapters[id] ?? "NOTE";
}
