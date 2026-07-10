export * from "./report/anchors";
export * from "./report/evidence";
export * from "./report/generate";
export * from "./report/overlap";
export * from "./report/prohibited";
export * from "./report/quality";
export * from "./report/templates/labels";
export * from "./report/wording";

import type { DiagnosisResult, ReportFragment } from "./types";
import { resultLabel } from "./report/generate";
import { wordingFor } from "./report/wording";

/** @deprecated Prefer generateFreeReport or generatePaidReport for complete report JSON. */
export function buildCoreFragments(result: DiagnosisResult): ReportFragment[] {
  return [
    {
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
    },
    {
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
    },
  ];
}
