import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { toAnswer } from "../src/ui/adapter";
import { activeUiScreen, hasSavedProgress, initialScreen, nextPageIndex, previousPageIndex, shouldScrollWindowToTop } from "../src/ui/flow";
import { buildQuestionPages } from "../src/ui/page-builder";
import { newSession, upsertAnswer } from "../src/ui/session";

const session = newSession();
assert.equal(initialScreen({ kind: "none" }), "top", "new visitors land on the top page");
assert.equal(initialScreen({ kind: "current", session }), "top", "resumable visitors still choose their next action from the top page");
assert.equal(initialScreen({ kind: "version-mismatch" }), "resume-blocked", "incompatible sessions cannot enter questions");
assert.equal(hasSavedProgress(session), false);

const firstQuestion = questionBank.commonType[0];
const firstAnswer = toAnswer(firstQuestion, firstQuestion.options[0], Date.now());
const changedAnswer = toAnswer(firstQuestion, firstQuestion.options[1], Date.now());
const resumed = { ...session, currentQuestionIds: questionBank.commonType.map((question) => question.id), answers: upsertAnswer([firstAnswer], changedAnswer) };
assert.equal(hasSavedProgress(resumed), true, "saved answers or a saved position expose resume actions");
assert.equal(resumed.answers.length, 1, "changed answers replace the previous answer rather than duplicating it");

const pages = buildQuestionPages(questionBank.commonType);
assert.equal(pages.length, 3, "12 common questions are rendered as three four-question pages");
assert.equal(previousPageIndex(0), 0);
assert.equal(previousPageIndex(2), 1);
assert.equal(nextPageIndex(0, pages.length), 1);
assert.equal(nextPageIndex(2, pages.length), 2);

assert.equal(activeUiScreen("restart-confirm", "top"), "top", "opening the restart modal keeps its normal screen identity");
assert.equal(activeUiScreen("restart-confirm", "intro"), "intro", "the restart modal retains its return screen");
assert.equal(activeUiScreen("generation-pending", "top"), "confirmation", "the generation handoff retains the confirmation screen until its UI is implemented");
assert.equal(shouldScrollWindowToTop(undefined, "top"), true, "the initial normal screen is positioned at the top");
assert.equal(shouldScrollWindowToTop("top", "intro"), true, "top to intro is a normal screen transition");
assert.equal(shouldScrollWindowToTop("intro", "questions"), true, "intro to questions is a normal screen transition");
assert.equal(shouldScrollWindowToTop("questions", "top"), true, "questions to top is a normal screen transition");
assert.equal(shouldScrollWindowToTop("questions", "confirmation"), true, "the final question set scrolls to the confirmation screen top");
assert.equal(shouldScrollWindowToTop("confirmation", "questions"), true, "reviewing answers scrolls back to the question screen top");
assert.equal(shouldScrollWindowToTop("result", "top"), true, "result to top is a normal screen transition");
assert.equal(shouldScrollWindowToTop("resume-blocked", "intro"), true, "resume-blocked to intro is a normal screen transition");
assert.equal(shouldScrollWindowToTop("top", "top"), false, "opening or cancelling a restart modal does not scroll the background");
console.log("UI screen-state, resume, restart, and page-navigation tests passed");
