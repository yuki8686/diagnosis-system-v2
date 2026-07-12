import { strict as assert } from "node:assert";
import { questionBank } from "../src/data/question-bank";
import { toAnswer } from "../src/ui/adapter";
import { activeUiScreen, hasSavedProgress, initialScreen, isResultLoadingComplete, nextPageIndex, previousPageIndex, RESULT_LOADING_STEP_MS, RESULT_LOADING_TITLES, resultLoadingTitleIndex, shouldScrollWindowToTop, shouldStartResultGeneration } from "../src/ui/flow";
import { confidenceLabel, resultStatusBanner, secondaryTypeNote, visibleFreeReportSection, visibleFreeReportSections } from "../src/ui/free-result";
import { buildQuestionPages } from "../src/ui/page-builder";
import { newSession, upsertAnswer } from "../src/ui/session";
import type { FreeReport } from "../src/types";

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
assert.equal(activeUiScreen("restart-confirm", "result"), "result", "the restart modal can open above the free result page");
assert.equal(activeUiScreen("generation-pending", "top"), "generation-pending", "the generation handoff displays the dedicated loading screen");
assert.equal(shouldStartResultGeneration("generation-pending", false, undefined, "session-a"), true, "a pending generation starts once for its session");
assert.equal(shouldStartResultGeneration("generation-pending", false, "session-a", "session-a"), false, "Strict Mode and rerenders cannot start a second generation for the same session");
assert.equal(shouldStartResultGeneration("generation-pending", true, undefined, "session-a"), false, "a saved report is never generated again");
assert.equal(RESULT_LOADING_TITLES[resultLoadingTitleIndex(0)], "あなたの回答を整理しています", "generation starts with the first approved loading title");
assert.equal(RESULT_LOADING_TITLES[resultLoadingTitleIndex(RESULT_LOADING_STEP_MS)], "人に見せる自分と、本音の違いを読み取っています", "the second loading title starts after 900ms");
assert.equal(RESULT_LOADING_TITLES[resultLoadingTitleIndex(RESULT_LOADING_STEP_MS * 2)], "あなたの結果をまとめています", "the third loading title starts after 1800ms");
assert.equal(isResultLoadingComplete(RESULT_LOADING_STEP_MS * 3 - 1), false, "the result cannot appear before the full loading duration");
assert.equal(isResultLoadingComplete(RESULT_LOADING_STEP_MS * 3), true, "the result can appear after the full loading duration");
assert.equal(shouldScrollWindowToTop(undefined, "top"), true, "the initial normal screen is positioned at the top");
assert.equal(shouldScrollWindowToTop("top", "intro"), true, "top to intro is a normal screen transition");
assert.equal(shouldScrollWindowToTop("intro", "questions"), true, "intro to questions is a normal screen transition");
assert.equal(shouldScrollWindowToTop("questions", "top"), true, "questions to top is a normal screen transition");
assert.equal(shouldScrollWindowToTop("questions", "confirmation"), true, "the final question set scrolls to the confirmation screen top");
assert.equal(shouldScrollWindowToTop("confirmation", "generation-pending"), true, "the generation screen scrolls to the top");
assert.equal(shouldScrollWindowToTop("confirmation", "questions"), true, "reviewing answers scrolls back to the question screen top");
assert.equal(shouldScrollWindowToTop("result", "top"), true, "result to top is a normal screen transition");
assert.equal(shouldScrollWindowToTop("resume-blocked", "intro"), true, "resume-blocked to intro is a normal screen transition");
assert.equal(shouldScrollWindowToTop("top", "top"), false, "opening or cancelling a restart modal does not scroll the background");

const report = {
  kind: "free",
  route: "resolved",
  label: "勝ち筋タイプ・打ち出す型",
  subtitle: "成果へ向かうために、自分の意図を外へ出す結果",
  summary: "回答時点の傾向です。",
  anchors: [],
  details: { gap: { state: "aligned", paragraphs: [] } },
  metadata: { sessionId: "session-a", questionBankVersion: "1", scoringVersion: "1", engineVersion: "1", reportTemplateVersion: "1", typeConfidence: "high", expressionConfidence: "medium", gapConfidence: "medium", defenseConfidence: "medium", utilizationConfidence: "medium", effectiveWording: { type: "direct", expression: "direct", gap: "direct", defense: "direct", utilization: "direct" }, reliabilityDowngradedBlocks: [] },
  sections: [
    { id: "expression", title: "出し方", paragraphs: [{ id: "expression-paragraph", text: "出し方の本文", anchorIds: [], layer: "expression", evidence: { block: "expression", evidenceLevel: "derived", sourceQuestionIds: [], confidence: "medium", wordingStrength: "direct", scenarioScope: "general" } }] },
    { id: "headline", title: "見出し", paragraphs: [{ id: "headline-paragraph", text: "ヒーローの本文", anchorIds: [], layer: "type", evidence: { block: "type", evidenceLevel: "inferred", sourceQuestionIds: [], confidence: "high", wordingStrength: "direct", scenarioScope: "general" } }] },
    { id: "disclaimer", title: "この結果について", paragraphs: [{ id: "disclaimer-paragraph", text: "医療行為ではありません。", anchorIds: [], layer: "type", evidence: { block: "type", evidenceLevel: "possibility", sourceQuestionIds: [], confidence: "high", wordingStrength: "direct", scenarioScope: "general" } }] },
    { id: "core_desire", title: "大切にしていること", paragraphs: [{ id: "core-paragraph", text: "コアの本文", anchorIds: [], layer: "type", evidence: { block: "type", evidenceLevel: "derived", sourceQuestionIds: [], confidence: "high", wordingStrength: "direct", scenarioScope: "general" } }] },
    { id: "observation", title: "観察のポイント", paragraphs: [{ id: "observation-paragraph", text: "観察の本文", anchorIds: [], layer: "defense_utilization", evidence: { block: "gap", evidenceLevel: "derived", sourceQuestionIds: [], confidence: "medium", wordingStrength: "direct", scenarioScope: "general" } }] },
  ],
} as FreeReport;

assert.equal(visibleFreeReportSection(report, "headline")?.paragraphs[0], "ヒーローの本文", "the headline is retrieved by its ID rather than report order");
assert.deepEqual(visibleFreeReportSections(report).map((section) => section.id), ["core_desire", "expression", "observation"], "body sections use their fixed display order even if report sections are reordered");
assert.equal(visibleFreeReportSections(report).some((section) => section.id === "headline"), false, "the headline is not repeated in the result body");
assert.equal(visibleFreeReportSection({ ...report, sections: [] }, "observation"), undefined, "a missing section does not crash the result view model");
assert.equal(JSON.stringify(visibleFreeReportSections(report)).includes("expression-paragraph"), false, "visible section content omits internal paragraph IDs and evidence");
assert.equal(confidenceLabel("high"), "判定の確からしさ：高い");
assert.equal(confidenceLabel("medium"), "判定の確からしさ：中程度");
assert.equal(confidenceLabel("low"), "判定の確からしさ：参考");
assert.equal(resultStatusBanner({ ...report, route: "resolved" }, { kind: "resolved", primary: "win", source: "base" }), undefined, "a resolved result does not show an unnecessary warning");
assert.equal(resultStatusBanner({ ...report, route: "low_confidence" }, { kind: "low-confidence", candidates: ["win", "connect"] })?.tone, "low", "a low-confidence route shows its status banner");
assert.equal(resultStatusBanner(report, { kind: "resolved", primary: "win", secondary: "connect", source: "comparison" })?.tone, "tie", "a comparison-resolved close type result shows its status banner");
assert.equal(secondaryTypeNote(report, { kind: "resolved", primary: "win", secondary: "connect", source: "comparison" }), "次点候補：つながりタイプ", "the secondary type is displayed through its user-facing label");
console.log("UI screen-state, resume, restart, and page-navigation tests passed");
