import type { Confidence, DiagnosisResult, EvidenceLevel, ReportFragment, WordingStrength } from "./types";
import { EXPRESSION_LABELS, TYPE_LABELS } from "./constants";

export function wordingFor(level: EvidenceLevel, confidence: Confidence): WordingStrength {
  if (confidence === "low") return level === "direct" ? "qualified" : level === "derived" ? "possibility" : "hidden";
  if (confidence === "medium") return level === "possibility" ? "possibility" : "qualified";
  return level === "possibility" ? "possibility" : "standard";
}

export function resultLabel(result: DiagnosisResult): string {
  if (result.resolution.kind === "low-confidence") {
    return result.resolution.candidates.map((id) => TYPE_LABELS[id]).join(" × ");
  }
  return `${TYPE_LABELS[result.resolution.primary]}・${EXPRESSION_LABELS[result.expression.pattern]}`;
}

export function buildCoreFragments(result: DiagnosisResult): ReportFragment[] {
  const fragments: ReportFragment[] = [];
  fragments.push({
    id: "result-label",
    section: "label",
    text: resultLabel(result),
    evidence: {
      evidenceLevel: "derived",
      sourceQuestionIds: result.answeredQuestionIds,
      sourceScores: [JSON.stringify(result.baseTypeScores), result.expression.pattern],
      confidence: result.confidence.type,
      scenarioScope: "general",
      wordingStrength: wordingFor("derived", result.confidence.type),
    },
  });
  fragments.push({
    id: "gap-summary",
    section: "gap",
    text: `gap:${result.gap.pattern}; strength:${result.gap.strength ?? "n/a"}; breadth:${result.gap.breadth}`,
    evidence: {
      evidenceLevel: "derived",
      sourceQuestionIds: result.gap.usedQuestionIds,
      sourceScores: [String(result.gap.magnitude), String(result.gap.directionConsistency), String(result.gap.breadth)],
      confidence: result.confidence.gap,
      scenarioScope: "general",
      wordingStrength: wordingFor("derived", result.confidence.gap),
    },
  });
  return fragments;
}
