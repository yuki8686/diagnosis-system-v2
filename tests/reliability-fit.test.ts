import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { deriveTypeFitSignals, detectReliability, evaluateTypeFit, reliabilityAssessment } from "../src/scoring";
import type { AnswerRecord, QuestionDefinition, TypeScores } from "../src/types";

const at = (questionId: string, optionId: string, numericValue?: number, displayedPosition?: number, durationMs = 5000): AnswerRecord => ({
  questionId,
  questionVersion: 1,
  optionId,
  numericValue,
  displayedPosition,
  answeredAt: "2026-07-10T00:00:00.000Z",
  durationMs,
});

const commonVaried = questionBank.commonType.slice(0, 8).map((question, index) => at(question.id, ["A", "B", "C", "D"][index % 4], undefined, index % 4));
assert.equal(detectReliability(questionBank.commonType, commonVaried.map((answer) => ({ ...answer, durationMs: 1000 }))).fastResponse, true);
assert.equal(detectReliability(questionBank.commonType, commonVaried.map((answer) => ({ ...answer, displayedPosition: 0 }))).positionStreak, true);

const semanticAnswers = questionBank.commonType.slice(0, 8).map((question, index) => at(question.id, "A", undefined, index % 4));
assert.equal(detectReliability(questionBank.commonType, semanticAnswers).semanticMonotony, true);

const likertQuestions = questionBank.byType.win.gap.slice(0, 8);
const likertAnswers = likertQuestions.map((question) => at(question.id, "3", 3));
assert.equal(detectReliability(likertQuestions, likertAnswers).likertSameValueStreak, true);

const utilizationQuestions = questionBank.byType.win.utilization;
const reverseAnswers = [at("U-A1", "5", 5), at("U-A2", "5", 5), at("U-R1", "5", 5), at("U-O1", "4", 4), at("U-O2", "4", 4), at("U-R2", "1", 1)];
assert.equal(detectReliability(utilizationQuestions, reverseAnswers).reverseContradiction, true);

const mismatchAnswers = [at("U-A1", "5", 5), at("U-A2", "5", 5), at("U-R1", "1", 1), at("U-O1", "4", 4), at("U-O2", "4", 4), at("U-R2", "1", 1), at("U-C1", "1", 1)];
assert.equal(detectReliability(utilizationQuestions, mismatchAnswers).similarQuestionMismatch, true);

const positionOnly = detectReliability(questionBank.commonType, commonVaried.map((answer) => ({ ...answer, displayedPosition: 0 })));
assert.equal(reliabilityAssessment(positionOnly).overallWeakening, false);
const multipleMain = { ...positionOnly, fastResponse: true, semanticMonotony: true };
const multipleTypeIssues = { ...multipleMain, issues: [
  { flag: "fastResponse" as const, affectedBlocks: ["type" as const], severity: "major" as const, sourceQuestionIds: ["C01"] },
  { flag: "semanticMonotony" as const, affectedBlocks: ["type" as const], severity: "major" as const, sourceQuestionIds: ["C01"] },
] };
assert.equal(reliabilityAssessment(multipleTypeIssues).overallWeakening, true);
assert.equal(reliabilityAssessment(multipleTypeIssues).weakenedBlocks.includes("type"), true);

const fitQuestion = questionBank.byType.win.expression.find((question) => question.id === "DS-FIT");
assert.ok(fitQuestion);
const clearBase: TypeScores = { win: 7, connect: 3, analyze: 1, axis: 1 };
const closeBase: TypeScores = { win: 5, connect: 4, analyze: 2, axis: 1 };
const fitOnlySignals = deriveTypeFitSignals([fitQuestion], [at("DS-FIT", "1", 1)], clearBase, "win");
assert.equal(fitOnlySignals.fitItemLow, true);
assert.equal(evaluateTypeFit(fitOnlySignals).incompatible, false);

const marginSignals = deriveTypeFitSignals([fitQuestion], [at("DS-FIT", "1", 1)], closeBase, "win");
assert.equal(marginSignals.baseMarginSmall, true);
assert.equal(evaluateTypeFit(marginSignals).incompatible, true);

const secondFit: QuestionDefinition = { ...fitQuestion, id: "DS-FIT-2", prompt: "別表現の適合確認" };
const secondSignals = deriveTypeFitSignals([fitQuestion, secondFit], [at("DS-FIT", "1", 1), at("DS-FIT-2", "2", 2)], clearBase, "win");
assert.equal(secondSignals.secondFitSignalLow, true);
assert.equal(evaluateTypeFit(secondSignals).incompatible, true);

const gapInner = questionBank.byType.win.gap.filter((question) => question.block === "gap-inner" && !question.isConfirmation);
const blockQuestions = [fitQuestion, ...gapInner];
const blockAnswers = [at("DS-FIT", "1", 1), ...gapInner.map((question) => at(question.id, "2", 2))];
const blockSignals = deriveTypeFitSignals(blockQuestions, blockAnswers, clearBase, "win");
assert.equal(blockSignals.blockInconsistency, false, "low inner-gap answers remain reference data, not a fit signal");
assert.equal(evaluateTypeFit(blockSignals).incompatible, false);

const lowUtilAnswers = utilizationQuestions.filter((question) => !question.isConfirmation).map((question) => at(question.id, "1", 1));
const lowUtilSignals = deriveTypeFitSignals(utilizationQuestions, lowUtilAnswers, clearBase, "win");
assert.equal(evaluateTypeFit(lowUtilSignals).incompatible, false);

console.log("reliability and type-fit signal tests passed");
