import { paidReportView } from "../api/_lib/report";
import type { PaidReport } from "../src/types";
import type { Env } from "./env";
import { accessTokenHashHex, createFirestorePaidReportStore, type PaidReportStore } from "./firestore";

const REPORT_NOT_AVAILABLE = "レポートを表示できません。";
const REPORT_RETRY = "レポートを表示できません。時間をおいてもう一度お試しください。";

export interface PaidReportDependencies {
  store: PaidReportStore;
  accessTokenHash: (token: string) => Promise<string>;
  now: () => number;
}

function jsonResponse(status: number, value: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

function isStoredPaidReport(value: unknown): value is PaidReport {
  if (!value || typeof value !== "object") return false;
  const report = value as { label?: unknown; subtitle?: unknown; sections?: unknown };
  return typeof report.label === "string"
    && typeof report.subtitle === "string"
    && Array.isArray(report.sections)
    && report.sections.every((section) => section
      && typeof section === "object"
      && typeof (section as { title?: unknown }).title === "string"
      && Array.isArray((section as { paragraphs?: unknown }).paragraphs)
      && (section as { paragraphs: unknown[] }).paragraphs.every((paragraph) => paragraph && typeof paragraph === "object" && typeof (paragraph as { text?: unknown }).text === "string"));
}

function runtimeDependencies(env: Env): PaidReportDependencies {
  const secret = env.REPORT_ACCESS_TOKEN_SECRET?.trim();
  if (!secret) throw new Error("report-access-unavailable");
  return {
    store: createFirestorePaidReportStore(env),
    accessTokenHash: async (token) => await accessTokenHashHex(token, secret),
    now: Date.now,
  };
}

export async function paidReportResponse(request: Request, env: Env, accessToken: string, dependencies?: PaidReportDependencies): Promise<Response> {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  if (!/^[A-Za-z0-9_-]{43}$/u.test(accessToken)) return jsonResponse(404, { error: REPORT_NOT_AVAILABLE });
  try {
    const activeDependencies = dependencies ?? runtimeDependencies(env);
    const result = await activeDependencies.store.findPaidReport(await activeDependencies.accessTokenHash(accessToken));
    if (!result || result.status !== "paid" || result.expiresAt === undefined || result.expiresAt <= activeDependencies.now() || !isStoredPaidReport(result.paidReport)) {
      return jsonResponse(404, { error: REPORT_NOT_AVAILABLE });
    }
    return jsonResponse(200, paidReportView(result.paidReport), { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  } catch {
    return jsonResponse(500, { error: REPORT_RETRY });
  }
}
