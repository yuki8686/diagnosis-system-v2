import type { DiagnosisSession } from "./session";

export type UiScreen = "top" | "intro" | "questions" | "confirmation" | "generation-pending" | "resume-blocked" | "restart-confirm" | "result";
export type NormalUiScreen = Exclude<UiScreen, "restart-confirm">;

export function activeUiScreen(screen: UiScreen, restartReturnScreen: NormalUiScreen): NormalUiScreen {
  if (screen === "restart-confirm") return restartReturnScreen;
  return screen;
}

export function shouldStartResultGeneration(screen: UiScreen, hasFreeReport: boolean, startedForSessionId: string | undefined, sessionId: string): boolean {
  return screen === "generation-pending" && !hasFreeReport && startedForSessionId !== sessionId;
}

export const RESULT_LOADING_TITLES = [
  "あなたの回答を整理しています",
  "人に見せる自分と、本音の違いを読み取っています",
  "あなたの結果をまとめています",
] as const;
export const RESULT_LOADING_STEP_MS = 900;

export function resultLoadingTitleIndex(elapsedMs: number): number {
  return Math.min(RESULT_LOADING_TITLES.length - 1, Math.max(0, Math.floor(elapsedMs / RESULT_LOADING_STEP_MS)));
}

export function isResultLoadingComplete(elapsedMs: number): boolean {
  return elapsedMs >= RESULT_LOADING_TITLES.length * RESULT_LOADING_STEP_MS;
}

export function shouldScrollWindowToTop(previous: NormalUiScreen | undefined, next: NormalUiScreen): boolean {
  return previous === undefined || previous !== next;
}

export function hasSavedProgress(session: DiagnosisSession): boolean {
  return session.answers.length > 0 || session.currentQuestionIds.length > 0;
}

export function initialScreen(load: { kind: "none" } | { kind: "current"; session: DiagnosisSession } | { kind: "version-mismatch" }): UiScreen {
  return load.kind === "version-mismatch" ? "resume-blocked" : "top";
}

export function previousPageIndex(pageIndex: number): number {
  return Math.max(0, pageIndex - 1);
}

export function nextPageIndex(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(0, pageCount - 1), pageIndex + 1);
}
