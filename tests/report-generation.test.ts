import { strict as assert } from "node:assert";
import { EXPRESSION_IDS, TYPE_IDS } from "../src/types";
import { generateFreeReport, generatePaidReport, resultLabel } from "../src/report";
import { labelTemplate } from "../src/report/templates/labels";
import { makeReportInput } from "./report-test-helpers";

for (const type of TYPE_IDS) for (const expression of EXPRESSION_IDS) {
  const input = makeReportInput({ type, expression });
  const free = generateFreeReport(input);
  const paid = generatePaidReport(input, free);
  const template = labelTemplate(type, expression);
  assert.equal(free.kind, "free");
  assert.equal(paid.kind, "paid");
  assert.equal(free.label, resultLabel(input.result));
  assert.equal(free.label, template.characterName, `${type}:${expression}: free report uses the approved character name`);
  assert.equal(free.summary, template.coreDesire, `${type}:${expression}: free report uses the approved core desire`);
  assert.equal(free.subtitle, template.expressionDescription, `${type}:${expression}: free report uses the approved expression description`);
  assert.equal(free.sections.find((section) => section.id === "headline")?.paragraphs[0]?.text, template.headline, `${type}:${expression}: free report uses the approved headline`);
  assert.equal(paid.label, template.characterName, `${type}:${expression}: paid report uses the same approved character name`);
  assert.equal(paid.subtitle, template.expressionDescription, `${type}:${expression}: paid report uses the same expression description`);
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
assert.doesNotMatch(lowFree.label, /勝ち筋タイプ|つながりタイプ|読み解きタイプ|軸タイプ/);
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
