import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { EXPECTED_COUNTS, flattenQuestionBank } from "../src/data/question-bank-contract";
import { validateQuestionBank } from "../src/validate";

const all = flattenQuestionBank(questionBank);
const issues = validateQuestionBank(questionBank);
assert.deepEqual(issues, []);
assert.equal(all.length, EXPECTED_COUNTS.physicalBankTotal);
assert.equal(new Set(all.map((q) => q.id)).size, all.length);
console.log(`question bank validation passed (${all.length} physical questions)`);
