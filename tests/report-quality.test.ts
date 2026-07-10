import { strict as assert } from "node:assert";
import { PAID_FREE_OVERLAP_LIMIT } from "../src/constants";
import { calculatePaidFreeOverlap, detectProhibitedExpressions, generateFreeReport, generatePaidReport, validatePaidReport, wordingFor } from "../src/report";
import type { FreeReport, PaidReport } from "../src/types";
import { makeReportInput } from "./report-test-helpers";

assert.equal(wordingFor("derived", "high"), "direct");
assert.equal(wordingFor("derived", "medium"), "moderate");
assert.equal(wordingFor("derived", "low"), "soft");

const input = makeReportInput();
const free = generateFreeReport(input);
const paid = generatePaidReport(input, free);
assert.deepEqual(generatePaidReport(input, free), paid);
assert.ok(paid.answerReferences.length >= 3);
assert.ok(new Set(paid.answerReferences.map((reference) => reference.questionId)).size >= 3);
assert.ok(paid.answerReferences.some((reference) => reference.questionId === "C01"));
assert.ok(paid.answerReferences.some((reference) => ["Z1-H", "Z1-P", "D1", "U-A1"].includes(reference.questionId)));
assert.ok(paid.anchors.some((anchor) => anchor.kind === "gap_pair"));
assert.ok(paid.actionProposals.length >= 1 && paid.actionProposals[0].sourceQuestionIds.length > 0);

const badVersion = makeReportInput();
badVersion.answers[0] = { ...badVersion.answers[0], questionVersion: 99 };
assert.throws(() => generateFreeReport(badVersion), /version mismatch/);
const duplicateAnswer = makeReportInput();
duplicateAnswer.answers.push(duplicateAnswer.answers[0]);
assert.throws(() => generatePaidReport(duplicateAnswer), /Duplicate report answer/);
const routeMismatch = makeReportInput();
routeMismatch.route = { ...routeMismatch.route, route: "low-confidence" };
assert.throws(() => generateFreeReport(routeMismatch), /route.*inconsistent/i);

const prohibited = detectProhibitedExpressions("あなたの本心は幼少期に決まり、恋愛では必ず成功します。100%です。");
assert.ok(new Set(prohibited.map((item) => item.category)).has("inner_truth"));
assert.ok(new Set(prohibited.map((item) => item.category)).has("causal_history"));
assert.ok(new Set(prohibited.map((item) => item.category)).has("deterministic_future"));

const mutated = structuredClone(paid) as PaidReport;
mutated.sections[0].paragraphs[0].text = "あなたの本心は、絶対に正しいです。";
assert.equal(validatePaidReport(mutated, free).passed, false);

const missingEvidence = structuredClone(paid) as PaidReport;
missingEvidence.sections[0].paragraphs[0].evidence.sourceQuestionIds = [];
assert.equal(validatePaidReport(missingEvidence, free).passed, false);

const tooFewAnswers = structuredClone(paid) as PaidReport;
tooFewAnswers.answerReferences = tooFewAnswers.answerReferences.slice(0, 2);
assert.equal(validatePaidReport(tooFewAnswers, free).passed, false);

const missingSection = structuredClone(paid) as PaidReport;
missingSection.sections = missingSection.sections.filter((section) => section.id !== "action");
assert.equal(validatePaidReport(missingSection, free).passed, false);

const noAction = structuredClone(paid) as PaidReport;
noAction.actionProposals = [];
assert.equal(validatePaidReport(noAction, free).passed, false);

const wordingMismatch = structuredClone(paid) as PaidReport;
wordingMismatch.sections[0].paragraphs[0].evidence.wordingStrength = "soft";
assert.ok(!validatePaidReport(wordingMismatch, free).passed && validatePaidReport(wordingMismatch, free).issues.some((issue) => issue.code === "wording_mismatch"));

const lowOverclaim = structuredClone(generatePaidReport(makeReportInput({ route: "low-confidence" }))) as PaidReport;
lowOverclaim.label = "勝ち筋タイプ";
assert.ok(!validatePaidReport(lowOverclaim).passed && validatePaidReport(lowOverclaim).issues.some((issue) => issue.code === "low_confidence_overclaim"));

const defenseOverclaim = structuredClone(generatePaidReport(makeReportInput({ defenseMode: "low", confidences: { defense: "low" } }))) as PaidReport;
defenseOverclaim.sections.find((section) => section.id === "defense")!.paragraphs[0].text = "第一防衛として分析する反応が確認されました。";
assert.ok(!validatePaidReport(defenseOverclaim).passed && validatePaidReport(defenseOverclaim).issues.some((issue) => issue.code === "defense_overclaim"));

const limitedOverclaim = structuredClone(generatePaidReport(makeReportInput({ defenseMode: "opportunity-limited", confidences: { defense: "low" } }))) as PaidReport;
limitedOverclaim.sections.find((section) => section.id === "defense")!.paragraphs[0].text = "安定した反応として固まる傾向があります。";
assert.ok(!validatePaidReport(limitedOverclaim).passed && validatePaidReport(limitedOverclaim).issues.some((issue) => issue.code === "opportunity_limited_overclaim"));

const overlapping = structuredClone(paid) as PaidReport;
const freeContent = free.sections.find((section) => section.id === "core_desire")!.paragraphs[0].text;
for (const section of overlapping.sections) for (const paragraph of section.paragraphs) paragraph.text = freeContent;
assert.ok(calculatePaidFreeOverlap(overlapping, free) > PAID_FREE_OVERLAP_LIMIT);
assert.equal(validatePaidReport(overlapping, free).passed, false);

function overlapFixture(sharedCount: number): { paid: PaidReport; free: FreeReport } {
  const localPaid = structuredClone(paid) as PaidReport;
  const localFree = structuredClone(free) as FreeReport;
  const contentSections = localPaid.sections.filter((section) => section.id !== "headline" && section.id !== "disclaimer");
  const shared = Array.from({ length: sharedCount }, (_, index) => `共有文章番号${index}は十分な長さを持つ検査文です`);
  const sentences = [...shared, ...Array.from({ length: 20 - sharedCount }, (_, index) => `有料固有文章番号${index}は十分な長さを持つ検査文です`)];
  localFree.sections = [{ ...localFree.sections.find((section) => section.id === "core_desire")!, paragraphs: [{ ...localFree.sections.find((section) => section.id === "core_desire")!.paragraphs[0], text: shared.join("。") }] }];
  contentSections.forEach((section, index) => {
    const assigned = index === 0 ? sentences.slice(0, 10) : [sentences[index + 9]];
    section.paragraphs = [{ ...section.paragraphs[0], text: assigned.join("。") }];
  });
  return { paid: localPaid, free: localFree };
}
const boundaryPass = overlapFixture(7);
assert.equal(calculatePaidFreeOverlap(boundaryPass.paid, boundaryPass.free), PAID_FREE_OVERLAP_LIMIT);
assert.ok(!validatePaidReport(boundaryPass.paid, boundaryPass.free).issues.some((issue) => issue.code === "excessive_free_overlap"));
const boundaryFail = overlapFixture(8);
assert.ok(calculatePaidFreeOverlap(boundaryFail.paid, boundaryFail.free) > PAID_FREE_OVERLAP_LIMIT);
assert.ok(!validatePaidReport(boundaryFail.paid, boundaryFail.free).passed && validatePaidReport(boundaryFail.paid, boundaryFail.free).issues.some((issue) => issue.code === "excessive_free_overlap"));

const excludedOverlap = structuredClone(paid) as PaidReport;
const excludedFree = structuredClone(free) as FreeReport;
excludedOverlap.sections.find((section) => section.id === "headline")!.paragraphs[0].text = "除外対象として同じ長いタイトル文章です。";
excludedFree.sections.find((section) => section.id === "headline")!.paragraphs[0].text = "除外対象として同じ長いタイトル文章です。";
excludedOverlap.sections.find((section) => section.id === "disclaimer")!.paragraphs[0].text = "除外対象として同じ長い注記文章です。";
excludedFree.sections.find((section) => section.id === "disclaimer")!.paragraphs[0].text = "除外対象として同じ長い注記文章です。";
assert.equal(calculatePaidFreeOverlap(excludedOverlap, excludedFree), calculatePaidFreeOverlap(paid, free));

const evidenceLevels = new Set(paid.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.evidence.evidenceLevel)));
for (const level of ["direct", "derived", "inferred", "possibility"]) assert.ok(evidenceLevels.has(level as never));
assert.ok(paid.sections.filter((section) => section.id === "work" || section.id === "relationships").every((section) => section.paragraphs.every((paragraph) => paragraph.evidence.evidenceLevel === "possibility")));

const informational = makeReportInput({ reliabilityIssues: [{ flag: "positionStreak", affectedBlocks: ["type"], severity: "info", sourceQuestionIds: ["C01"] }] });
assert.equal(generateFreeReport(informational).sections.find((section) => section.id === "core_desire")!.paragraphs[0].evidence.wordingStrength, "direct");
const doubleMajor = makeReportInput({ reliabilityIssues: [
  { flag: "fastResponse", affectedBlocks: ["utilization"], severity: "major", sourceQuestionIds: ["U-A1"] },
  { flag: "semanticMonotony", affectedBlocks: ["utilization"], severity: "major", sourceQuestionIds: ["U-A1"] },
] });
const doublePaid = generatePaidReport(doubleMajor, generateFreeReport(doubleMajor));
assert.equal(doublePaid.sections.find((section) => section.id === "utilization")!.paragraphs[0].evidence.wordingStrength, "soft");
assert.equal(doublePaid.sections.find((section) => section.id === "core_desire")!.paragraphs[0].evidence.wordingStrength, "direct");

const resolvedReverse = makeReportInput({ confirmation: true, confidences: { utilization: "high" }, reliabilityIssues: [
  { flag: "reverseContradiction", affectedBlocks: ["utilization"], severity: "major", sourceQuestionIds: ["U-A1"] },
  { flag: "semanticMonotony", affectedBlocks: ["utilization"], severity: "major", sourceQuestionIds: ["U-A1"] },
] });
resolvedReverse.result.utilization.confirmationStatus = "resolved";
const resolvedReversePaid = generatePaidReport(resolvedReverse, generateFreeReport(resolvedReverse));
assert.equal(resolvedReversePaid.sections.find((section) => section.id === "utilization")!.paragraphs[0].evidence.wordingStrength, "direct");

console.log("report quality, prohibited wording, overlap, and confidence tests passed");
