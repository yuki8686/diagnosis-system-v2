import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { EXPECTED_COUNTS, flattenQuestionBank } from "../src/data/question-bank-contract";
import { validateQuestionBank } from "../src/validate";

const all = flattenQuestionBank(questionBank);
const issues = validateQuestionBank(questionBank);
assert.deepEqual(issues, []);
assert.equal(EXPECTED_COUNTS.comparisons, 24);
assert.equal(EXPECTED_COUNTS.physicalBankTotal, 163);
assert.equal(all.length, 163);
assert.equal(new Set(all.map((q) => q.id)).size, all.length);
assert.equal(Object.values(questionBank.comparisons).length, 6);
for (const questions of Object.values(questionBank.comparisons)) assert.equal(questions.length, 4);
for (const id of ["VS-WC-3", "VS-WC-4", "VS-WR-3", "VS-WR-4", "VS-WJ-3", "VS-WJ-4", "VS-CR-3", "VS-CR-4", "VS-CJ-3", "VS-CJ-4", "VS-RJ-3", "VS-RJ-4"]) {
  assert.ok(all.some((q) => q.id === id), `missing additional comparison ${id}`);
}
const ge04 = all.find((q) => q.id === "GE04");
assert.ok(ge04);
assert.equal(ge04.isConfirmation, undefined);
assert.equal(questionBank.genericExpression.filter((q) => !q.isConfirmation).length, 4);

const wrongPair = structuredClone(questionBank);
wrongPair.comparisons["connect-win"][2].options[0].typeId = "analyze";
assert.ok(validateQuestionBank(wrongPair).some((issue) => issue.code === "COMPARISON_PAIR_TYPES"));

const wrongPairKeyMapping = structuredClone(questionBank);
for (const question of wrongPairKeyMapping.comparisons["connect-win"]) {
  question.options[0].typeId = "axis";
  question.options[1].typeId = "analyze";
}
assert.ok(validateQuestionBank(wrongPairKeyMapping).some((issue) => issue.code === "COMPARISON_PAIR_KEY_TYPES"));

const duplicateComparison = structuredClone(questionBank);
duplicateComparison.comparisons["connect-win"][3].prompt = duplicateComparison.comparisons["connect-win"][2].prompt;
assert.ok(validateQuestionBank(duplicateComparison).some((issue) => issue.code === "DUPLICATE_COMPARISON_PROMPT"));

console.log(`question bank validation passed (${all.length} physical questions)`);
