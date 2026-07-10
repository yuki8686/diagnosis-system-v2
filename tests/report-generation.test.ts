import { strict as assert } from "node:assert";
import { EXPRESSION_IDS, TYPE_IDS } from "../src/types";
import { generateFreeReport, generatePaidReport, resultLabel } from "../src/report";
import { makeReportInput } from "./report-test-helpers";

for (const type of TYPE_IDS) for (const expression of EXPRESSION_IDS) {
  const input = makeReportInput({ type, expression });
  const free = generateFreeReport(input);
  const paid = generatePaidReport(input, free);
  assert.equal(free.kind, "free");
  assert.equal(paid.kind, "paid");
  assert.equal(free.label, resultLabel(input.result));
  assert.ok(free.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.evidence && paragraph.evidence.sourceQuestionIds.length > 0)));
  assert.ok(paid.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.evidence && paragraph.evidence.sourceQuestionIds.length > 0)));
  assert.equal(paid.qualityGate.passed, true);
}

const lowInput = makeReportInput({ route: "low-confidence" });
const lowFree = generateFreeReport(lowInput);
const lowPaid = generatePaidReport(lowInput, lowFree);
assert.equal(lowFree.route, "low_confidence");
assert.equal(lowPaid.route, "low_confidence");
assert.match(lowFree.label, /×/);
assert.doesNotMatch(lowFree.label, /・打ち出す型/);
assert.equal(lowPaid.sections.length, 8);

for (const limit of [0, 1, 2] as const) assert.equal(generateFreeReport(makeReportInput({ freeAnchorLimit: limit })).anchors.length, limit);
assert.ok(generateFreeReport(makeReportInput()).anchors.length <= 2);

for (const report of [lowFree, lowPaid]) {
  assert.equal(report.metadata.questionBankVersion.length > 0, true);
  assert.equal(report.metadata.scoringVersion.length > 0, true);
  assert.equal(report.metadata.engineVersion.length > 0, true);
  assert.equal(report.metadata.reportTemplateVersion.length > 0, true);
}

console.log("report generation and 12-label tests passed");
