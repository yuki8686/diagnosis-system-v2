import { PAID_FREE_OVERLAP_LIMIT } from "../constants";
import type { FreeReport, PaidReport, PaidReportQualityIssue, PaidReportQualityResult, ReportSectionId, WordingStrength } from "../types";
import { calculatePaidFreeOverlap } from "./overlap";
import { detectProhibitedExpressions } from "./prohibited";

const RESOLVED_REQUIRED: ReportSectionId[] = ["headline", "core_desire", "expression", "strengths", "friction", "gap", "defense", "utilization", "relationships", "work", "action", "observation", "disclaimer"];
const LOW_REQUIRED: ReportSectionId[] = ["headline", "core_desire", "expression", "gap", "defense", "utilization", "action", "disclaimer"];

const expectedWording = (confidence: "high" | "medium" | "low"): WordingStrength => confidence === "high" ? "direct" : confidence === "medium" ? "moderate" : "soft";

export function validatePaidReport(report: PaidReport, freeReport?: FreeReport): PaidReportQualityResult {
  const issues: PaidReportQualityIssue[] = [];
  const add = (code: PaidReportQualityIssue["code"], message: string, sectionId?: ReportSectionId, paragraphId?: string) => issues.push({ code, message, sectionId, paragraphId });
  if (!report.metadata.reportTemplateVersion) add("missing_version", "reportTemplateVersion is required");
  const sectionIds = new Set(report.sections.map((section) => section.id));
  for (const id of report.route === "resolved" ? RESOLVED_REQUIRED : LOW_REQUIRED) if (!sectionIds.has(id)) add("missing_section", `Required section is missing: ${id}`, id);
  for (const section of report.sections) for (const paragraph of section.paragraphs) {
    if (!paragraph.evidence || !paragraph.evidence.sourceQuestionIds.length) add("missing_evidence", "Paragraph evidence and sourceQuestionIds are required", section.id, paragraph.id);
    const downgraded = paragraph.evidence?.sourceScores?.reliabilityDowngraded === true;
    if (paragraph.evidence && paragraph.evidence.wordingStrength !== (downgraded ? "soft" : expectedWording(paragraph.evidence.confidence))) add("wording_mismatch", "confidence and wordingStrength are inconsistent", section.id, paragraph.id);
    if ((paragraph.evidence?.scenarioScope === "work_possibility" || paragraph.evidence?.scenarioScope === "relationship_possibility") && paragraph.evidence.evidenceLevel !== "possibility") add("scenario_scope_mismatch", "Unmeasured domains must use possibility evidence", section.id, paragraph.id);
    for (const finding of detectProhibitedExpressions(paragraph.text)) add("prohibited_expression", `${finding.category}: ${finding.matchedText}`, section.id, paragraph.id);
  }
  const usedSourceIds = new Set(report.sections.flatMap((section) => section.paragraphs.flatMap((paragraph) => paragraph.evidence.sourceQuestionIds)));
  const usedReferences = report.answerReferences.filter((reference) => usedSourceIds.has(reference.questionId));
  const distinctReferences = new Set(usedReferences.map((reference) => reference.questionId));
  if (distinctReferences.size < 3) add("insufficient_answer_references", "Paid report requires at least three distinct answer references");
  if (!usedReferences.some((reference) => reference.questionId.startsWith("C") || reference.questionId.startsWith("VS-"))) add("insufficient_answer_references", "A type or comparison answer reference is required");
  if (!usedReferences.some((reference) => reference.metric === "gap" || reference.metric === "defense" || reference.metric === "awareness" || reference.metric === "utilization")) add("insufficient_answer_references", "A gap, defense, or utilization answer reference is required");
  const gapAnchor = report.anchors.find((anchor) => anchor.kind === "gap_pair");
  if (gapAnchor && !report.sections.find((section) => section.id === "gap")?.paragraphs.some((paragraph) => gapAnchor.sourceQuestionIds.every((id) => paragraph.evidence.sourceQuestionIds.includes(id)))) add("missing_max_gap", "Maximum gap pair is not reflected in the gap section", "gap");
  const defenseAnchors = report.anchors.filter((anchor) => anchor.kind === "defense" || anchor.kind === "observed_reaction");
  const defenseText = report.sections.find((section) => section.id === "defense")?.paragraphs.map((paragraph) => paragraph.text).join(" ") ?? "";
  if (defenseAnchors.some((anchor) => anchor.confidence === "low") && /第一防衛として/.test(defenseText)) add("defense_overclaim", "Low-confidence defense must not be stated as a sole primary defense", "defense");
  if (defenseAnchors.some((anchor) => anchor.opportunityLimited) && /安定した反応|一貫した反応|第一防衛として/.test(defenseText)) add("opportunity_limited_overclaim", "Opportunity-limited reactions must remain scene-limited", "defense");
  if (report.route === "low_confidence" && !report.label.includes("×")) add("low_confidence_overclaim", "Low-confidence report must show multiple candidates");
  if (!report.actionProposals.length || !sectionIds.has("action")) add("missing_action", "At least one action proposal is required", "action");
  for (const action of report.actionProposals) if (!action.sourceQuestionIds.length) add("missing_action_evidence", "Action proposal requires sourceQuestionIds", "action");
  if (freeReport && calculatePaidFreeOverlap(report, freeReport) > PAID_FREE_OVERLAP_LIMIT) add("excessive_free_overlap", `Free/paid overlap exceeds ${PAID_FREE_OVERLAP_LIMIT}`);
  return issues.length ? { passed: false, issues } : { passed: true, issues: [] };
}

export class PaidReportQualityError extends Error {
  constructor(public readonly issues: PaidReportQualityIssue[]) {
    super(`Paid report quality gate failed: ${issues.map((issue) => issue.code).join(", ")}`);
  }
}
