import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { toAnswer } from "../src/ui/adapter";
import { buildQuestionPages } from "../src/ui/page-builder";
import { CURRENT_VERSIONS, upsertAnswer, versionsMatch } from "../src/ui/session";

const pages = buildQuestionPages([...questionBank.commonType, ...questionBank.defense]);
assert.equal(pages.flat().length, 19);
assert.ok(pages.every((page) => page.length <= 4));
assert.ok(pages.every((page) => new Set(page.map((q) => q.block)).size === 1));
const question = questionBank.commonType[0];
const first = toAnswer(question, question.options[0], Date.now());
const second = { ...first, optionId: question.options[1].id };
assert.deepEqual(upsertAnswer([first], second), [second]);
assert.equal(versionsMatch({ versions: CURRENT_VERSIONS }), true);
assert.equal(versionsMatch({ versions: { ...CURRENT_VERSIONS, engineVersion: "old" } }), false);
assert.equal(versionsMatch({ versions: { ...CURRENT_VERSIONS, reportTemplateVersion: "1.0.0" } }), false, "sessions generated before the structured free report format cannot resume");
console.log("UI page, answer, and version-session tests passed");
