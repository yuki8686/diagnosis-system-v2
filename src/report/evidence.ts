import type { Confidence, DiagnosisBlock, EvidenceLevel, ReportEvidence, ReportInput, ReportScenarioScope } from "../types";
import { effectiveWording } from "./wording";

export function evidenceFor(input: ReportInput, block: DiagnosisBlock, level: EvidenceLevel, sourceQuestionIds: string[], scenarioScope: ReportScenarioScope = "general", sourceScores?: ReportEvidence["sourceScores"]): ReportEvidence {
  const ids = [...new Set(sourceQuestionIds)].filter(Boolean);
  if (!ids.length) throw new Error(`Report evidence requires sourceQuestionIds: ${block}/${level}`);
  const confidence: Confidence = input.result.confidence[block];
  const issues = input.result.reliability.issues.filter((issue) => {
    if (issue.flag !== "reverseContradiction") return true;
    if (block === "utilization" && input.result.utilization.confirmationStatus === "resolved") return false;
    if (block === "expression" && input.result.expression.confirmationStatus === "resolved") return false;
    return true;
  });
  const wording = effectiveWording(block, confidence, issues);
  return {
    evidenceLevel: level,
    sourceQuestionIds: ids,
    sourceScores: { ...(sourceScores ?? {}), reliabilityDowngraded: wording.reliabilityDowngraded },
    confidence,
    wordingStrength: wording.strength,
    scenarioScope,
  };
}

export function qualifierFor(input: ReportInput, block: DiagnosisBlock): string {
  const issues = input.result.reliability.issues.filter((issue) => issue.flag !== "reverseContradiction" || !((block === "utilization" && input.result.utilization.confirmationStatus === "resolved") || (block === "expression" && input.result.expression.confirmationStatus === "resolved")));
  return effectiveWording(block, input.result.confidence[block], issues).qualifier;
}
