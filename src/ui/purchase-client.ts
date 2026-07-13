import type { DiagnosisSession } from "./session";

const ACCESS_TOKEN_PREFIX = "diagnosis-v2-report-access:";

export interface ServerResultReference {
  resultId: string;
  accessToken: string;
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(typeof (value as { error?: unknown } | undefined)?.error === "string" ? (value as { error: string }).error : "処理を完了できませんでした。");
  return value;
}

function storedKey(sessionId: string): string { return `${ACCESS_TOKEN_PREFIX}${sessionId}`; }

export function loadServerResultReference(sessionId: string): ServerResultReference | undefined {
  try {
    const raw = sessionStorage.getItem(storedKey(sessionId));
    const value: unknown = raw ? JSON.parse(raw) : undefined;
    if (!value || typeof value !== "object") return undefined;
    const candidate = value as Partial<ServerResultReference>;
    return typeof candidate.resultId === "string" && typeof candidate.accessToken === "string" ? { resultId: candidate.resultId, accessToken: candidate.accessToken } : undefined;
  } catch { return undefined; }
}

export function saveServerResultReference(sessionId: string, reference: ServerResultReference): void {
  sessionStorage.setItem(storedKey(sessionId), JSON.stringify(reference));
}

export async function ensureServerResult(session: DiagnosisSession): Promise<ServerResultReference> {
  const existing = loadServerResultReference(session.sessionId);
  if (existing) return existing;
  const value = await requestJson("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session }) });
  const candidate = value as Partial<ServerResultReference>;
  if (typeof candidate.resultId !== "string" || typeof candidate.accessToken !== "string") throw new Error("診断結果を準備できませんでした。時間をおいてもう一度お試しください。");
  const reference = { resultId: candidate.resultId, accessToken: candidate.accessToken };
  saveServerResultReference(session.sessionId, reference);
  return reference;
}

export async function beginCheckout(session: DiagnosisSession): Promise<void> {
  const result = await ensureServerResult(session);
  const value = await requestJson("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
  const checkoutUrl = (value as { checkoutUrl?: unknown }).checkoutUrl;
  if (typeof checkoutUrl !== "string") throw new Error("購入手続きを開始できませんでした。時間をおいてもう一度お試しください。");
  window.location.assign(checkoutUrl);
}

export async function saveFeedbackToServer(session: DiagnosisSession, rating: number, comment: string): Promise<void> {
  const result = await ensureServerResult(session);
  await requestJson("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...result, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }) });
}

export async function purchaseStatus(reference: ServerResultReference): Promise<"awaiting-payment" | "generation-pending" | "paid" | "generation-failed" | "expired"> {
  const value = await requestJson("/api/purchase-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reference) });
  const status = (value as { status?: unknown }).status;
  if (status === "awaiting-payment" || status === "generation-pending" || status === "paid" || status === "generation-failed" || status === "expired") return status;
  throw new Error("購入状況を確認できませんでした。");
}
