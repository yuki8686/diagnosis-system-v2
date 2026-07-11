import type { Confidence, DiagnosisBlock, EvidenceLevel, ReportEvidence, ReportInput, ReportScenarioScope } from "../types";
import { effectiveWording } from "./wording";

function applicableIssues(input: ReportInput, block: DiagnosisBlock) {
  return input.result.reliability.issues.filter((issue) => {
    if (issue.flag !== "reverseContradiction") return true;
    if (block === "utilization" && input.result.utilization.confirmationStatus === "resolved") return false;
    if (block === "expression" && input.result.expression.confirmationStatus === "resolved") return false;
    return true;
  });
}

export function effectiveWordingForInput(input: ReportInput, block: DiagnosisBlock) {
  return effectiveWording(block, input.result.confidence[block], applicableIssues(input, block));
}

export function evidenceFor(input: ReportInput, block: DiagnosisBlock, level: EvidenceLevel, sourceQuestionIds: string[], scenarioScope: ReportScenarioScope = "general", sourceScores?: ReportEvidence["sourceScores"]): ReportEvidence {
  const ids = [...new Set(sourceQuestionIds)].filter(Boolean);
  if (!ids.length) throw new Error(`Report evidence requires sourceQuestionIds: ${block}/${level}`);
  const confidence: Confidence = input.result.confidence[block];
  const wording = effectiveWordingForInput(input, block);
  return {
    block,
    evidenceLevel: level,
    sourceQuestionIds: ids,
    sourceScores: { ...(sourceScores ?? {}), reliabilityDowngraded: wording.reliabilityDowngraded },
    confidence,
    wordingStrength: wording.strength,
    scenarioScope,
  };
}

export function qualifierFor(input: ReportInput, block: DiagnosisBlock): string {
  return effectiveWordingForInput(input, block).qualifier;
}
