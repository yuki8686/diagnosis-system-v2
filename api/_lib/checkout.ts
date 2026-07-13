import { isAccessToken } from "./access-token";

export interface CheckoutRequest {
  resultId: string;
  accessToken: string;
}

export function checkoutRequest(value: unknown): CheckoutRequest | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { resultId?: unknown; accessToken?: unknown };
  if (typeof candidate.resultId !== "string" || !/^[0-9a-f-]{36}$/i.test(candidate.resultId) || !isAccessToken(candidate.accessToken)) return undefined;
  return { resultId: candidate.resultId, accessToken: candidate.accessToken };
}
