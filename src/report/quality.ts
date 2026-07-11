import { PAID_FREE_OVERLAP_LIMIT } from "../constants";
import type { FreeReport, PaidReport, PaidReportQualityIssue, PaidReportQualityResult, ReportSectionId } from "../types";
import { calculatePaidFreeOverlap } from "./overlap";
import { detectProhibitedExpressions } from "./prohibited";

const RESOLVED_REQUIRED: ReportSectionId[] = ["headline", "core_desire", "expression", "strengths", "friction", "gap", "defense", "utilization", "relationships", "work", "action", "observation", "disclaimer"];
const LOW_REQUIRED: ReportSectionId[] = ["headline", "core_desire", "expression", "gap", "defense", "utilization", "action", "disclaimer"];

export function validatePaidReport(report: PaidReport, freeReport?: FreeReport): PaidReportQualityResult {
  const issues: PaidReportQualityIssue[] = [];
  const add = (code: PaidReportQualityIssue["code"], message: string, sectionId?: ReportSectionId, paragraphId?: string) => issues.push({ code, message, sectionId, paragraphId });
  if (!report.metadata.reportTemplateVersion) add("missing_version", "reportTemplateVersion is required");
  const sectionIds = new Set(report.sections.map((section) => section.id));
  for (const id of report.route === "resolved" ? RESOLVED_REQUIRED : LOW_REQUIRED) if (!sectionIds.has(id)) add("missing_section", `Required section is missing: ${id}`, id);
  for (const section of report.sections) for (const paragraph of section.paragraphs) {
    if (!paragraph.evidence || !paragraph.evidence.sourceQuestionIds.length) add("missing_evidence", "Paragraph evidence and sourceQuestionIds are required", section.id, paragraph.id);
    const structuralWording = paragraph.evidence ? report.metadata.effectiveWording[paragraph.evidence.block] : undefined;
    if (paragraph.evidence && (!structuralWording || paragraph.evidence.wordingStrength !== structuralWording)) add("wording_mismatch", "wordingStrength does not match report structural wording metadata", section.id, paragraph.id);
    const templateClaim = /^(?:paid|free)-(?:core|expression|protects|impression|strength|misunderstanding|friction|relationships|work)/.test(paragraph.id);
    if (templateClaim && paragraph.evidence?.wordingStrength === "soft" && /(?:人です|強みです|しやすい人です|特徴です)。?$/.test(paragraph.text)) add("wording_mismatch", "Soft template paragraph retains a strong declarative ending", section.id, paragraph.id);
    if ((paragraph.evidence?.scenarioScope === "work_possibility" || paragraph.evidence?.scenarioScope === "relationship_possibility") && paragraph.evidence.evidenceLevel !== "possibility") add("scenario_scope_mismatch", "Unmeasured domains must use possibility evidence", section.id, paragraph.id);
    for (const finding of detectProhibitedExpressions(paragraph.text)) add("prohibited_expression", `${finding.category}: ${finding.matchedText}`, section.id, paragraph.id);
    if (section.id === "defense" && !paragraph.claimKind) add("defense_overclaim", "Defense paragraphs require a structured claimKind", section.id, paragraph.id);
    if (paragraph.claimKind === "primary_defense") {
      if (!report.defenseContext.primary || report.defenseContext.confidence === "low" || paragraph.claimCategory !== report.defenseContext.primary) add("defense_overclaim", "Primary-defense claim does not match DefenseResult", section.id, paragraph.id);
      if (paragraph.claimCategory && report.defenseContext.opportunityLimited.includes(paragraph.claimCategory)) add("opportunity_limited_overclaim", "Opportunity-limited category cannot be a stable primary-defense claim", section.id, paragraph.id);
    }
    if (paragraph.claimKind === "defense_tie" && report.defenseContext.primaryTied.length < 2) add("defense_overclaim", "Defense-tie claim does not match DefenseResult", section.id, paragraph.id);
  }
  const visibleText = [report.label, report.subtitle, ...report.sections.flatMap((section) => [section.title, ...section.paragraphs.map((paragraph) => paragraph.text)])].join("\n");
  for (const finding of detectProhibitedExpressions(visibleText)) if (!issues.some((issue) => issue.code === "prohibited_expression" && issue.message.includes(finding.matchedText))) add("prohibited_expression", `${finding.category}: ${finding.matchedText}`);
  const internalTokens = ["strong", "medium", "light", "not_needed", "pending", "resolved", "unresolved", "skipped", "low_confidence", "suppression", "amplification", "reversal", "unclear", "growth"];
  if (internalTokens.some((token) => new RegExp(`(^|[^A-Za-z])${token}([^A-Za-z]|$)`).test(visibleText)) || /\b[a-z]+_[a-z_]+\b/.test(visibleText) || /\b\d+\.\d+\b/.test(visibleText)) add("internal_value_leak", "User-facing text contains an internal enum, snake_case value, or raw decimal score");
  const usedSourceIds = new Set(report.sections.flatMap((section) => section.paragraphs.filter((paragraph) => paragraph.evidence.evidenceLevel === "direct").flatMap((paragraph) => paragraph.evidence.sourceQuestionIds)));
  const usedReferences = report.answerReferences.filter((reference) => usedSourceIds.has(reference.questionId));
  const distinctReferences = new Set(usedReferences.map((reference) => reference.questionId));
  if (distinctReferences.size < 3) add("insufficient_answer_references", "Paid report requires at least three distinct answer references");
  if (!usedReferences.some((reference) => reference.questionId.startsWith("C") || reference.questionId.startsWith("VS-"))) add("insufficient_answer_references", "A type or comparison answer reference is required");
  if (!usedReferences.some((reference) => reference.metric === "gap" || reference.metric === "defense" || reference.metric === "awareness" || reference.metric === "utilization")) add("insufficient_answer_references", "A gap, defense, or utilization answer reference is required");
  const gapAnchor = report.anchors.find((anchor) => anchor.kind === "gap_pair");
  if (gapAnchor && !report.sections.find((section) => section.id === "gap")?.paragraphs.some((paragraph) => gapAnchor.sourceQuestionIds.every((id) => paragraph.evidence.sourceQuestionIds.includes(id)))) add("missing_max_gap", "Maximum gap pair is not reflected in the gap section", "gap");
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
