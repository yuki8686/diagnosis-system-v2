import { strict as assert } from "node:assert";
import { ENGINE_VERSION, QUESTION_BANK_VERSION, REPORT_TEMPLATE_VERSION, SCORING_VERSION } from "../src/constants";
import { questionBank } from "../src/data/question-bank";
import { applyReliabilityToConfidences, classifyResultVersion, detectReliability, scoreGap, scoreUtilization } from "../src/scoring";
import type { AnswerRecord, BlockConfidences, ResultMetadata } from "../src/types";
import { validateAnswerRecords } from "../src/validate";

const at = (questionId: string, optionId: string, numericValue?: number, durationMs?: number): AnswerRecord => ({
  questionId, questionVersion: 1, optionId, numericValue, answeredAt: "2026-07-10T00:00:00.000Z", durationMs,
});

assert.throws(
  () => validateAnswerRecords([questionBank.commonType[0]], [{ ...at("C01", "A"), questionVersion: 99 }]),
  /C01.*answerVersion=99.*expectedVersion=1/i,
);
assert.throws(() => validateAnswerRecords([questionBank.commonType[0]], [at("C01", "A"), at("C01", "B")]), /duplicate.*C01/i);
for (const question of [questionBank.commonType[0], questionBank.byType.win.expression[0], questionBank.defense[0], questionBank.byType.win.gap[0], questionBank.byType.win.utilization[0]]) {
  const value = question.format === "likert-5" ? 3 : undefined;
  const record = at(question.id, value == null ? question.options[0].id : String(value), value);
  assert.throws(() => validateAnswerRecords([question], [record, { ...record }]), new RegExp(`duplicate.*${question.id}`, "i"));
}
assert.throws(() => validateAnswerRecords([questionBank.genericExpression[0]], [at("GE01", "3", 5)]), /optionId=3.*numericValue=5/i);

const missingDurations = [at("C01", "A"), { ...at("C02", "B"), durationMs: Number.NaN }];
assert.doesNotThrow(() => detectReliability(questionBank.commonType.slice(0, 2), missingDurations));
assert.equal(detectReliability(questionBank.commonType.slice(0, 2), missingDurations).fastResponse, false);

const currentMetadata: ResultMetadata = { questionBankVersion: QUESTION_BANK_VERSION, scoringVersion: SCORING_VERSION, engineVersion: ENGINE_VERSION, reportTemplateVersion: REPORT_TEMPLATE_VERSION };
assert.equal(classifyResultVersion(currentMetadata), "current");
assert.equal(classifyResultVersion({ ...currentMetadata, scoringVersion: "0.9.0" }), "read-only");
assert.throws(() => classifyResultVersion({ ...currentMetadata, reportTemplateVersion: "" }), /reportTemplateVersion/i);

const utilizationQuestions = questionBank.byType.win.utilization;
const reliabilityAnswers = [
  at("U-A1", "5", 5, 5000), at("U-A2", "5", 5, 5000), at("U-R1", "5", 5, 5000),
  at("U-O1", "4", 4, 5000), at("U-O2", "4", 4, 5000), at("U-R2", "1", 1, 5000), at("U-C1", "1", 1, 5000),
];
const utilizationReliability = detectReliability(utilizationQuestions, reliabilityAnswers);
assert.ok(utilizationReliability.issues.some((issue) => issue.flag === "reverseContradiction" && issue.affectedBlocks.includes("utilization")));
assert.ok(utilizationReliability.issues.some((issue) => issue.flag === "similarQuestionMismatch" && issue.affectedBlocks.includes("utilization")));
const highConfidences: BlockConfidences = { type: "high", expression: "high", gap: "high", defense: "high", utilization: "high" };
const weakened = applyReliabilityToConfidences(highConfidences, utilizationReliability.issues);
assert.equal(weakened.utilization, "low");
assert.equal(weakened.type, "high", "non-type reliability issues must not lower type confidence");
const reverseOnly = applyReliabilityToConfidences(highConfidences, utilizationReliability.issues.filter((issue) => issue.flag === "reverseContradiction"));
assert.equal(reverseOnly.utilization, "high", "one major signal alone does not lower confidence");

const positionAnswers = questionBank.commonType.slice(0, 8).map((question) => ({ ...at(question.id, "A", undefined, 5000), displayedPosition: 0 }));
const positionReliability = detectReliability(questionBank.commonType.slice(0, 8), positionAnswers);
assert.equal(positionReliability.positionStreak, true);
assert.equal(applyReliabilityToConfidences(highConfidences, positionReliability.issues).type, "high");

const localizedQuestions = [...questionBank.commonType.slice(0, 8), questionBank.defense[0]];
const localizedAnswers = [...questionBank.commonType.slice(0, 8).map((question) => at(question.id, "A", undefined, 5000)), at("D1", "B", undefined, 5000)];
const semanticIssue = detectReliability(localizedQuestions, localizedAnswers).issues.find((issue) => issue.flag === "semanticMonotony");
assert.deepEqual(semanticIssue?.affectedBlocks, ["type"]);

const gapAnswers = questionBank.byType.win.gap.filter((q) => !q.isConfirmation).map((q) => at(q.id, "3", 3, 5000));
assert.throws(() => scoreGap(questionBank.byType.win.gap, gapAnswers, { includeConfirmation: true, confirmationSkipped: true }), /cannot.*both|invalid/i);
const utilizationBase = utilizationQuestions.filter((q) => !q.isConfirmation).map((q) => at(q.id, "3", 3, 5000));
assert.throws(() => scoreUtilization(utilizationQuestions, utilizationBase, { confirmationRequested: true, confirmationSkipped: true }), /cannot.*both|invalid/i);
assert.throws(() => scoreGap(questionBank.byType.win.gap, gapAnswers, { confirmationAnswered: true }), /confirmationQuestionIds/i);

console.log("answer validation, version, and block reliability tests passed");
