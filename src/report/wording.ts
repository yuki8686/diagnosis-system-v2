import type { Confidence, DiagnosisBlock, EvidenceLevel, ReliabilityIssue, WordingStrength } from "../types";

export function wordingFor(_level: EvidenceLevel, confidence: Confidence): WordingStrength {
  return confidence === "high" ? "direct" : confidence === "medium" ? "moderate" : "soft";
}

export function effectiveWording(block: DiagnosisBlock, confidence: Confidence, issues: ReliabilityIssue[]): { strength: WordingStrength; qualifier: string; reliabilityDowngraded: boolean } {
  const major = new Set(issues.filter((issue) => issue.severity === "major" && issue.affectedBlocks.includes(block) && issue.flag !== "positionStreak").map((issue) => issue.flag));
  if (major.size >= 2) return { strength: "soft", qualifier: "今回確認できた範囲では、", reliabilityDowngraded: true };
  if (major.size === 1) return { strength: wordingFor("derived", confidence), qualifier: "回答の一部に確認上の揺れがあるため、今回の回答範囲では、", reliabilityDowngraded: false };
  return {
    strength: wordingFor("derived", confidence),
    qualifier: confidence === "medium" ? "今回の回答では、比較的、" : confidence === "low" ? "場面によっては、" : "",
    reliabilityDowngraded: false,
  };
}
