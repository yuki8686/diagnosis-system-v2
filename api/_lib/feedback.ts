export const FEEDBACK_COMMENT_MAX_LENGTH = 500;
import { isAccessToken } from "./access-token";

export type FeedbackPayload = { resultId: string; accessToken: string; rating: 1 | 2 | 3 | 4 | 5; comment?: string };

export function feedbackPayload(value: unknown): FeedbackPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { resultId?: unknown; accessToken?: unknown; rating?: unknown; comment?: unknown };
  if (typeof candidate.resultId !== "string" || !/^[0-9a-f-]{36}$/i.test(candidate.resultId)) return undefined;
  if (!isAccessToken(candidate.accessToken)) return undefined;
  if (![1, 2, 3, 4, 5].includes(candidate.rating as number)) return undefined;
  if (candidate.comment !== undefined && typeof candidate.comment !== "string") return undefined;
  const comment = typeof candidate.comment === "string" ? candidate.comment.trim() : "";
  if (comment.length > FEEDBACK_COMMENT_MAX_LENGTH) return undefined;
  return { resultId: candidate.resultId, accessToken: candidate.accessToken, rating: candidate.rating as FeedbackPayload["rating"], ...(comment ? { comment } : {}) };
}
