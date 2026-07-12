import { ENGINE_VERSION, QUESTION_BANK_VERSION, REPORT_TEMPLATE_VERSION, SCORING_VERSION } from "../constants";
import type { AnswerRecord, ComparisonResolution, DiagnosisRoute, FreeReport, TypeResolution } from "../types";

export const STORAGE_KEY = "diagnosis-v2-session";
export const CURRENT_VERSIONS = { questionBankVersion: QUESTION_BANK_VERSION, scoringVersion: SCORING_VERSION, engineVersion: ENGINE_VERSION, reportTemplateVersion: REPORT_TEMPLATE_VERSION } as const;

export interface QuestionHistoryEntry {
  questionIds: string[];
  pageIndex: number;
  stage: string;
  typeResolution?: TypeResolution;
  comparisonResolution?: ComparisonResolution;
  route?: DiagnosisRoute;
}

export interface DiagnosisSession {
  sessionId: string;
  sessionSeed: string;
  answers: AnswerRecord[];
  route?: DiagnosisRoute;
  typeResolution?: TypeResolution;
  comparisonResolution?: ComparisonResolution;
  currentQuestionIds: string[];
  currentPageIndex: number;
  questionHistory?: QuestionHistoryEntry[];
  invalidatedAnswerQuestionIds?: string[];
  savedAt: string;
  versions: typeof CURRENT_VERSIONS;
  freeReport?: FreeReport;
}

export function newSession(): DiagnosisSession {
  const id = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`;
  return { sessionId: id, sessionSeed: `${id}-${Math.random().toString(36).slice(2)}`, answers: [], currentQuestionIds: [], currentPageIndex: 0, savedAt: new Date().toISOString(), versions: CURRENT_VERSIONS };
}

export function upsertAnswer(answers: AnswerRecord[], answer: AnswerRecord): AnswerRecord[] {
  return [...answers.filter((item) => item.questionId !== answer.questionId), answer];
}

export function activeSessionAnswers(session: DiagnosisSession): AnswerRecord[] {
  const invalidated = new Set(session.invalidatedAnswerQuestionIds ?? []);
  return session.answers.filter((answer) => !invalidated.has(answer.questionId));
}

const stageOrder: Record<string, number> = { common: 0, "comparison-initial": 1, "comparison-additional": 2, "type-route": 3 };

export function invalidateDerivedState(session: DiagnosisSession, allowedAnswerQuestionIds: string[], stage: string, preserveTypeResolution: boolean): DiagnosisSession {
  const allowed = new Set(allowedAnswerQuestionIds);
  const invalidatedAnswerQuestionIds = [...new Set(session.answers.map((answer) => answer.questionId).filter((questionId) => !allowed.has(questionId)))];
  const currentOrder = stageOrder[stage] ?? -1;
  const questionHistory = (session.questionHistory ?? []).filter((entry) => (stageOrder[entry.stage] ?? -1) < currentOrder);
  return {
    ...session,
    invalidatedAnswerQuestionIds,
    questionHistory,
    ...(preserveTypeResolution ? {} : { typeResolution: undefined }),
    comparisonResolution: undefined,
    route: undefined,
    freeReport: undefined,
  };
}

export function questionHistoryEntry(session: DiagnosisSession, stage: string): QuestionHistoryEntry {
  return {
    questionIds: [...session.currentQuestionIds],
    pageIndex: session.currentPageIndex,
    stage,
    ...(session.typeResolution ? { typeResolution: session.typeResolution } : {}),
    ...(session.comparisonResolution ? { comparisonResolution: session.comparisonResolution } : {}),
    ...(session.route ? { route: session.route } : {}),
  };
}

export function restorePreviousQuestionHistory(session: DiagnosisSession): DiagnosisSession | undefined {
  const history = session.questionHistory ?? [];
  const previous = history.at(-1);
  if (!previous) return undefined;
  return {
    ...session,
    currentQuestionIds: previous.questionIds,
    currentPageIndex: previous.pageIndex,
    questionHistory: history.slice(0, -1),
    typeResolution: previous.typeResolution,
    comparisonResolution: previous.comparisonResolution,
    route: previous.route,
  };
}

export function versionsMatch(value: unknown): value is DiagnosisSession {
  if (!value || typeof value !== "object") return false;
  return JSON.stringify((value as { versions?: unknown }).versions) === JSON.stringify(CURRENT_VERSIONS);
}

export function saveSession(session: DiagnosisSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, savedAt: new Date().toISOString() }));
}

export function loadSession(): { kind: "none" } | { kind: "current"; session: DiagnosisSession } | { kind: "version-mismatch" } {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { kind: "none" };
  try { const value: unknown = JSON.parse(raw); return versionsMatch(value) ? { kind: "current", session: value } : { kind: "version-mismatch" }; }
  catch { return { kind: "version-mismatch" }; }
}
