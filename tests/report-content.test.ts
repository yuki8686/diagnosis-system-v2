import { strict as assert } from "node:assert";
import { EXPRESSION_IDS, TYPE_IDS } from "../src/types";
import {
  detectProhibitedExpressions,
  generateFreeReport,
  generatePaidReport,
  LABEL_TEMPLATES,
  PaidReportQualityError,
} from "../src/report";
import type { FreeReport, ReportSection } from "../src/types";
import { makeReportInput } from "./report-test-helpers";

const body = (sections: ReportSection[]): string => sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.text)).join("\n");
const internalValues = [
  "strong", "medium", "light", "not_needed", "pending", "resolved", "unresolved", "skipped",
  "low_confidence", "suppression", "amplification", "reversal", "unclear", "growth",
];

for (const type of TYPE_IDS) for (const expression of EXPRESSION_IDS) {
  const input = makeReportInput({ type, expression });
  const free = generateFreeReport(input);
  const paid = generatePaidReport(input, free);
  const visible = `${free.label}\n${free.subtitle}\n${free.summary}\n${body(free.sections)}\n${paid.label}\n${paid.subtitle}\n${body(paid.sections)}`;
  for (const value of internalValues) assert.doesNotMatch(visible, new RegExp(`(^|[^A-Za-z])${value}([^A-Za-z]|$)`), `${type}/${expression}: ${value}`);
  assert.doesNotMatch(visible, /\b\d+\.\d+\b/, `${type}/${expression}: raw decimal`);
  assert.ok(LABEL_TEMPLATES[`${type}:${expression}`]);
}

for (const type of TYPE_IDS) {
  const variants = EXPRESSION_IDS.map((expression) => generatePaidReport(makeReportInput({ type, expression })));
  const signatures = variants.map((report) => report.sections.filter((section) => ["headline", "core_desire", "strengths", "friction"].includes(section.id)).map((section) => section.paragraphs.map((paragraph) => paragraph.text).join(" ")).join("\n"));
  assert.equal(new Set(signatures).size, 3, `${type}: three expression variants need distinct paid content`);
}

const adaptive = generateFreeReport(makeReportInput({ expression: "adaptive" }));
assert.doesNotMatch(body(adaptive.sections), /確認されたときに用いる|欲望が弱い|隠している/);
assert.match(body(adaptive.sections), /場面|相手/);

const punchInput = makeReportInput();
const punch = generateFreeReport(punchInput).sections.flatMap((section) => section.paragraphs).find((paragraph) => paragraph.id === "free-answer-punch");
assert.ok(punch);
assert.equal(punch!.evidence.evidenceLevel, "direct");
assert.equal(punch!.evidence.sourceQuestionIds.length, 1);
assert.match(punch!.text, /たとえば、あなたは.+場面で.+を選んでいます/);

const layered = generatePaidReport(makeReportInput());
assert.deepEqual(new Set(layered.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.layer))), new Set(["type", "expression", "gap", "defense_utilization", "personalization"]));
assert.ok(layered.sections.flatMap((section) => section.paragraphs).filter((paragraph) => paragraph.layer === "personalization").length >= 3);

const missingExpression = makeReportInput();
missingExpression.result.expression.usedQuestionIds = [];
assert.throws(() => generateFreeReport(missingExpression), /expression.*source|source.*expression/i);

const highDefense = generatePaidReport(makeReportInput({ defenseMode: "primary" }));
const primaryClaim = highDefense.sections.find((section) => section.id === "defense")!.paragraphs.find((paragraph) => paragraph.claimKind === "primary_defense");
assert.ok(primaryClaim);
assert.match(primaryClaim!.text, /第一防衛/);
const fixtureDefense = makeReportInput().result.defense;
assert.deepEqual(fixtureDefense.opportunities, { counterattack: 2, prove: 5, distance: 5, "self-efface": 5, analyze: 5, "self-blame": 3, numb: 2, freeze: 1 });
assert.deepEqual(fixtureDefense.opportunityLimited, ["counterattack", "self-blame", "numb", "freeze"]);

const defenseLow = generatePaidReport(makeReportInput({ defenseMode: "low", confidences: { defense: "low" } }));
assert.ok(defenseLow.sections.find((section) => section.id === "defense")!.paragraphs.every((paragraph) => paragraph.claimKind !== "primary_defense"));

const smallDefenseHigh = generateFreeReport(makeReportInput({ gapPattern: "small", defenseMode: "primary" }));
assert.ok(smallDefenseHigh.sections.flatMap((section) => section.paragraphs).some((paragraph) => paragraph.id === "free-hook-defense"));
const smallDefenseLowGap = generateFreeReport(makeReportInput({ gapPattern: "small", defenseMode: "low", confidences: { defense: "low" }, utilizationGap: 2 }));
assert.ok(smallDefenseLowGap.sections.flatMap((section) => section.paragraphs).some((paragraph) => paragraph.id === "free-hook-utilization"));
const strengthsFallback = generateFreeReport(makeReportInput({ gapPattern: "small", defenseMode: "low", confidences: { defense: "low" }, utilizationGap: 0 }));
assert.ok(strengthsFallback.sections.flatMap((section) => section.paragraphs).some((paragraph) => paragraph.id === "free-hook-strength"));

const paraphrases = [
  "根底では違うことを望んでいます", "生まれつきこの傾向があります", "過去の経験が原因です",
  "脳構造で決まります", "あなたは必ず成功します", "相手は不安だと感じるでしょう", "この関係の未来は安泰です",
];
for (const phrase of paraphrases) assert.ok(detectProhibitedExpressions(phrase).length > 0, phrase);

const validInput = makeReportInput();
const validFree = generateFreeReport(validInput);
const overlappingFree = structuredClone(validFree) as FreeReport;
const paidWithoutFree = generatePaidReport(validInput);
overlappingFree.sections = paidWithoutFree.sections.map((section) => ({ ...section, paragraphs: section.paragraphs.map((paragraph) => ({ ...paragraph })) }));
assert.throws(() => generatePaidReport(validInput, overlappingFree), PaidReportQualityError);

console.log("full report content, layers, internal-value, source, and claim tests passed");
