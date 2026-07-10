import { EXPRESSION_LABELS, TYPE_LABELS } from "../constants";
import type { FreeReport, PaidReport, ReportSection } from "../types";

const excludedSections = new Set(["headline", "disclaimer"]);
const labels = [...Object.values(TYPE_LABELS), ...Object.values(EXPRESSION_LABELS)];

function normalizedSentences(sections: ReportSection[]): string[] {
  return sections
    .filter((section) => !excludedSections.has(section.id))
    .flatMap((section) => section.paragraphs.flatMap((paragraph) => paragraph.text.split(/[。！？!?]/)))
    .map((sentence) => labels.reduce((text, label) => text.replaceAll(label, ""), sentence))
    .map((sentence) => sentence.replace(/[\s、。，．・「」『』（）()\[\]：:]/g, "").trim())
    .filter((sentence) => sentence.length >= 8 && !sentence.includes("医療行為ではありません"));
}

export function calculatePaidFreeOverlap(paid: PaidReport, free: FreeReport): number {
  const freeSentences = new Set(normalizedSentences(free.sections));
  const paidSentences = normalizedSentences(paid.sections);
  if (!paidSentences.length) return 0;
  return paidSentences.filter((sentence) => freeSentences.has(sentence)).length / paidSentences.length;
}
