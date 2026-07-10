import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { needsUtilizationConfirmation, scoreExpression, scoreGap, scoreUtilization } from "../src/scoring";
import type { AnswerRecord } from "../src/types";

const at = (questionId: string, value: number): AnswerRecord => ({
  questionId,
  questionVersion: 1,
  optionId: String(value),
  numericValue: value,
  answeredAt: "2026-07-10T00:00:00.000Z",
  durationMs: 5000,
});

const gapAnswers = (diffs: number[]): AnswerRecord[] => diffs.flatMap((diff, index) => {
  const pair = `Z${index + 1}`;
  const inner = diff >= 0 ? 1 : 5;
  const publicValue = inner + diff;
  return [at(`${pair}-H`, inner), at(`${pair}-P`, publicValue)];
});

const winGap = questionBank.byType.win.gap;
const small = scoreGap(winGap, gapAnswers([0, 0, 0, 0, 0]));
assert.equal(small.pattern, "small");
assert.equal(small.direction, "none");
assert.equal(small.confidence, "high");

const suppression = scoreGap(winGap, gapAnswers([-2, -2, -1, -2, -3]));
assert.equal(suppression.pattern, "suppression");
assert.equal(suppression.direction, "negative");
assert.equal(suppression.strength, "medium");
assert.equal(suppression.breadth, 5);

const amplification = scoreGap(winGap, gapAnswers([1, 1, 0, 1, 2]));
assert.equal(amplification.pattern, "amplification");
assert.equal(amplification.direction, "positive");
assert.equal(amplification.strength, "light");
assert.equal(amplification.breadth, 4);

const reversal = scoreGap(winGap, gapAnswers([2, -2, 1, -2, 0]));
assert.equal(reversal.pattern, "reversal");
assert.equal(reversal.direction, "mixed");

const unclearBase = gapAnswers([1, 1, -1, 0, 0]);
const unclear = scoreGap(winGap, unclearBase);
assert.equal(unclear.pattern, "unclear");
assert.equal(unclear.direction, "unclear");
assert.equal(unclear.confidence, "low");

const confirmed = scoreGap(winGap, [...unclearBase, ...gapAnswers([0, 0, 0, 0, 0, 1]).slice(-2)], { includeConfirmation: true });
assert.equal(confirmed.pairs.length, 6);
assert.equal(confirmed.pattern, "amplification");
assert.equal(confirmed.confidence, "medium");
assert.equal(confirmed.confirmationStatus, "resolved");

const stillUnclear = scoreGap(winGap, [...unclearBase, at("Z6-H", 3), at("Z6-P", 3)], { includeConfirmation: true });
assert.equal(stillUnclear.pattern, "unclear");
assert.equal(stillUnclear.confidence, "low");
assert.equal(stillUnclear.confirmationStatus, "unresolved");

const skipped = scoreGap(winGap, unclearBase, { confirmationSkipped: true });
assert.equal(skipped.confidence, "low");
assert.equal(skipped.confirmationStatus, "skipped");

const strong = scoreGap(winGap, gapAnswers([-3, -3, -4, -3, -2]));
assert.equal(strong.strength, "strong");
assert.equal(strong.magnitude, 3);

const utilizationQuestions = questionBank.byType.win.utilization;
const noContradiction = [at("U-A1", 5), at("U-A2", 4), at("U-R1", 1), at("U-O1", 4), at("U-O2", 5), at("U-R2", 1)];
assert.equal(needsUtilizationConfirmation(utilizationQuestions, noContradiction), false);
assert.equal(scoreUtilization(utilizationQuestions, noContradiction).confidence, "high");

const contradiction = [at("U-A1", 5), at("U-A2", 5), at("U-R1", 5), at("U-O1", 4), at("U-O2", 4), at("U-R2", 1)];
assert.equal(needsUtilizationConfirmation(utilizationQuestions, contradiction), true);
const pending = scoreUtilization(utilizationQuestions, contradiction);
assert.equal(pending.confidence, "low");
assert.equal(pending.requiresConfirmation, true);

const confirmedUtilization = scoreUtilization(utilizationQuestions, [...contradiction, at("U-C1", 5), at("U-C2", 4)], { confirmationRequested: true });
assert.equal(confirmedUtilization.confidence, "medium");
assert.equal(confirmedUtilization.confirmationStatus, "resolved");

const unresolvedUtilization = scoreUtilization(utilizationQuestions, [...contradiction, at("U-C1", 2), at("U-C2", 4)], { confirmationRequested: true });
assert.equal(unresolvedUtilization.confidence, "low");
assert.equal(unresolvedUtilization.confirmationStatus, "unresolved");

const skippedUtilization = scoreUtilization(utilizationQuestions, contradiction, { confirmationSkipped: true });
assert.equal(skippedUtilization.confidence, "low");
assert.equal(skippedUtilization.confirmationStatus, "skipped");

const expressionQuestions = questionBank.byType.win.expression;
const middleBase = [at("DS1", 3), at("DS2", 3), at("DS3", 3), at("DS-FIT", 5)];
const pendingExpression = scoreExpression(expressionQuestions, middleBase, false);
assert.equal(pendingExpression.pattern, "inward");
assert.equal(pendingExpression.confidence, "low");
assert.equal(pendingExpression.requiresConfirmation, true);
assert.equal(pendingExpression.confirmationStatus, "pending");

const adaptiveExpression = scoreExpression(expressionQuestions, [...middleBase, at("DS-M1", 4), at("DS-M2", 5)], false, { confirmationActivated: true, confirmationAnswered: true, confirmationQuestionIds: ["DS-M1", "DS-M2"] });
assert.equal(adaptiveExpression.pattern, "adaptive");
assert.equal(adaptiveExpression.confidence, "medium");
assert.equal(adaptiveExpression.confirmationStatus, "resolved");

const outwardMiddle = [at("DS1", 4), at("DS2", 3), at("DS3", 3), at("DS-FIT", 5), at("DS-M1", 2), at("DS-M2", 3)];
const leanedExpression = scoreExpression(expressionQuestions, outwardMiddle, false, { confirmationActivated: true, confirmationAnswered: true, confirmationQuestionIds: ["DS-M1", "DS-M2"] });
assert.equal(leanedExpression.rawScore, 10);
assert.equal(leanedExpression.pattern, "outward");
assert.equal(leanedExpression.confidence, "low");
assert.equal(leanedExpression.confirmationStatus, "unresolved");

console.log("gap and utilization confirmation tests passed");
