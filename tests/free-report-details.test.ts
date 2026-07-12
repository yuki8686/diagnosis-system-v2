import { strict as assert } from "node:assert";
import { EXPRESSION_IDS, TYPE_IDS } from "../src/types";
import { generateFreeReport } from "../src/report";
import { freeGapState } from "../src/report/generate";
import { CONDITION_TEMPLATES, LABEL_TEMPLATES } from "../src/report/templates/labels";
import { makeReportInput } from "./report-test-helpers";

for (const type of TYPE_IDS) for (const expression of EXPRESSION_IDS) {
  const key = `${type}:${expression}` as const;
  assert.ok(LABEL_TEMPLATES[key], `${key}: an existing label template is required`);
  assert.ok(CONDITION_TEMPLATES[key], `${key}: a condition template is required`);
  const report = generateFreeReport(makeReportInput({ type, expression }));
  const publicSelf = report.details.publicSelf;
  assert.ok(publicSelf, `${key}: resolved reports have public-self data`);
  assert.ok(publicSelf!.traits.length >= 2 && publicSelf!.traits.length <= 4, `${key}: public traits remain within the supported range`);
  assert.equal(new Set(publicSelf!.traits.map((item) => item.text)).size, publicSelf!.traits.length, `${key}: public traits are not duplicated`);
  assert.ok(publicSelf!.misunderstanding, `${key}: resolved reports retain their existing misunderstanding template`);
  const conditions = report.details.conditions;
  assert.ok(conditions, `${key}: non-low type confidence generates conditions`);
  for (const group of [conditions!.energizing, conditions!.blocking]) {
    assert.ok(group.length >= 2 && group.length <= 3, `${key}: condition lists use two or three items`);
    for (const item of group) {
      assert.equal(/ときでは/.test(item.text), false, `${key}: condition grammar remains natural`);
      assert.ok(item.text.trim().length > 0, `${key}: conditions are never empty`);
      assert.ok((item.text.match(/可能性があります/g) ?? []).length <= 1, `${key}: possibility wording is not duplicated`);
    }
  }
}

const explicitGap = generateFreeReport(makeReportInput({ gapPattern: "suppression", confidences: { gap: "high" } }));
assert.equal(explicitGap.details.privateSelf?.paragraphs.length, 2, "a clear, reliable gap generates private-self details");
assert.ok(explicitGap.details.privateSelf!.paragraphs.every((item) => item.evidence.evidenceLevel !== "direct"), "private-self interpretations are not direct evidence");
for (const gapPattern of ["small", "unclear"] as const) assert.equal(generateFreeReport(makeReportInput({ gapPattern })).details.privateSelf, undefined, `${gapPattern}: private-self details are hidden`);
assert.equal(generateFreeReport(makeReportInput({ gapPattern: "amplification", confidences: { gap: "low" } })).details.privateSelf, undefined, "low-confidence gaps hide private-self details");

const gapStates = [
  { pattern: "small", state: "aligned" },
  { pattern: "suppression", strength: "light", state: "light" },
  { pattern: "suppression", strength: "medium", state: "medium" },
  { pattern: "suppression", strength: "strong", state: "strong" },
  { pattern: "amplification", strength: "light", state: "light" },
  { pattern: "amplification", strength: "medium", state: "medium" },
  { pattern: "amplification", strength: "strong", state: "strong" },
  { pattern: "reversal", state: "mixed" },
  { pattern: "unclear", state: "unclear" },
] as const;
for (const expected of gapStates) {
  const input = makeReportInput({ gapPattern: expected.pattern });
  input.result.gap.strength = "strength" in expected ? expected.strength : null;
  assert.equal(freeGapState(input.result.gap), expected.state, `${expected.pattern}: existing gap values map without new thresholds`);
}
for (const pattern of ["suppression", "amplification"] as const) {
  const input = makeReportInput({ gapPattern: pattern });
  input.result.gap.strength = null;
  assert.throws(() => freeGapState(input.result.gap), /requires a strength/, `${pattern}: missing strength is rejected`);
}
const unknownPattern = makeReportInput().result.gap;
assert.throws(() => freeGapState({ ...unknownPattern, pattern: "unknown" as never }), /Unsupported gap pattern/, "unknown gap patterns are rejected");

const lowRoute = generateFreeReport(makeReportInput({ route: "low-confidence" }));
assert.equal(lowRoute.details.publicSelf, undefined, "low-confidence reports do not invent a single-type public-self summary");
assert.equal(lowRoute.details.conditions, undefined, "low-confidence reports do not generate conditions without a dedicated template");
const lowRoutePrivate = generateFreeReport(makeReportInput({ route: "low-confidence", gapPattern: "suppression", confidences: { gap: "high" } }));
assert.equal(lowRoutePrivate.details.privateSelf?.paragraphs.length, 1, "low-confidence private-self details keep only the gap-based paragraph");
const typeLow = generateFreeReport(makeReportInput({ confidences: { type: "low" } }));
assert.equal(typeLow.details.conditions, undefined, "low type confidence hides conditions");

const details = explicitGap.details;
const displayItems = [
  ...(details.publicSelf?.traits ?? []),
  ...(details.publicSelf?.misunderstanding ? [details.publicSelf.misunderstanding] : []),
  ...(details.privateSelf?.paragraphs ?? []),
  ...details.gap.paragraphs,
  ...(details.conditions?.energizing ?? []),
  ...(details.conditions?.blocking ?? []),
];
assert.equal(new Set(displayItems.map((item) => item.id)).size, displayItems.length, "all detail items have stable unique IDs");
for (const item of displayItems) {
  assert.ok(item.evidence.sourceQuestionIds.length > 0, `${item.id}: evidence keeps its sources`);
  assert.ok(Array.isArray(item.anchorIds), `${item.id}: anchor IDs are retained`);
  assert.notEqual(item.evidence.evidenceLevel, "direct", `${item.id}: template-derived detail is not direct evidence`);
}
assert.deepEqual(explicitGap.sections.map((section) => section.id), ["headline", "core_desire", "expression", "observation", "disclaimer"], "the existing free-report sections remain unchanged");
assert.equal(explicitGap.sections.find((section) => section.id === "observation")!.paragraphs.some((item) => item.id === "free-hook-gap"), false, "observation no longer duplicates the gap overview");

console.log("free report structured detail tests passed");
