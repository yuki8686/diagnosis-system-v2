import type { DiagnosisSession } from "./session";

export type UiScreen = "top" | "intro" | "questions" | "resume-blocked" | "restart-confirm" | "result";
export type NormalUiScreen = Exclude<UiScreen, "restart-confirm">;

export function activeUiScreen(screen: UiScreen, restartReturnScreen: NormalUiScreen): NormalUiScreen {
  return screen === "restart-confirm" ? restartReturnScreen : screen;
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
