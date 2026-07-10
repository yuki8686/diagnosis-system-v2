import { strict as assert } from "node:assert";
import { generateFreeReport, generatePaidReport } from "../src/report";
import { makeReportInput } from "./report-test-helpers";

const cases = [
  { name: "A", input: makeReportInput({ type: "win", expression: "outward", gapPattern: "amplification" }), route: "resolved" },
  { name: "B", input: makeReportInput({ type: "win", expression: "inward", gapPattern: "suppression", utilizationGap: 2 }), route: "resolved" },
  { name: "C", input: makeReportInput({ route: "low-confidence", expression: "adaptive", gapPattern: "reversal" }), route: "low_confidence" },
] as const;

for (const testCase of cases) {
  const free = generateFreeReport(testCase.input);
  const paid = generatePaidReport(testCase.input, free);
  assert.equal(free.route, testCase.route, `${testCase.name}: free route`);
  assert.equal(paid.route, testCase.route, `${testCase.name}: paid route`);
  assert.equal(paid.qualityGate.passed, true, `${testCase.name}: quality`);
  assert.ok(paid.sections.some((section) => section.id === "gap"));
  assert.ok(paid.sections.some((section) => section.id === "action"));
}

const confirmed = makeReportInput({ expression: "adaptive", confirmation: true, confidences: { expression: "medium" } });
const confirmedPaid = generatePaidReport(confirmed, generateFreeReport(confirmed));
assert.ok(confirmedPaid.anchors.some((anchor) => anchor.kind === "confirmation"));
assert.ok(confirmedPaid.answerReferences.some((reference) => reference.questionId === "DS-M1"));
assert.equal(confirmedPaid.sections.find((section) => section.id === "expression")!.paragraphs[0].evidence.wordingStrength, "moderate");

const tied = makeReportInput({ defenseMode: "tie", confidences: { defense: "low" } });
const tiedPaid = generatePaidReport(tied, generateFreeReport(tied));
assert.match(tiedPaid.sections.find((section) => section.id === "defense")!.paragraphs[0].text, /同率/);
assert.doesNotMatch(tiedPaid.sections.find((section) => section.id === "defense")!.paragraphs[0].text, /単独で多く/);

const defenseLow = makeReportInput({ defenseMode: "low", confidences: { defense: "low" } });
const defenseLowPaid = generatePaidReport(defenseLow, generateFreeReport(defenseLow));
assert.match(defenseLowPaid.sections.find((section) => section.id === "defense")!.paragraphs[0].text, /特定場面/);
assert.doesNotMatch(defenseLowPaid.sections.find((section) => section.id === "defense")!.paragraphs[0].text, /第一防衛として/);

const limited = makeReportInput({ defenseMode: "opportunity-limited", confidences: { defense: "low" } });
const limitedPaid = generatePaidReport(limited, generateFreeReport(limited));
assert.match(limitedPaid.sections.find((section) => section.id === "defense")!.paragraphs[0].text, /特定場面|場面限定/);

const smallGap = makeReportInput({ gapPattern: "small" });
const smallPaid = generatePaidReport(smallGap, generateFreeReport(smallGap));
assert.match(smallPaid.sections.find((section) => section.id === "gap")!.paragraphs[0].text, /ズレ小/);

const utilizationGap = makeReportInput({ utilizationGap: 2 });
const utilizationPaid = generatePaidReport(utilizationGap, generateFreeReport(utilizationGap));
assert.match(utilizationPaid.sections.find((section) => section.id === "utilization")!.paragraphs[0].text, /段差は2\.0/);

console.log("report A/B/C, confirmation, tie, and fallback integration tests passed");
