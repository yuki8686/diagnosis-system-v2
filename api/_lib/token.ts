import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { reportAccessTokenSecret } from "./env";

export function resultId(): string { return randomUUID(); }
export function reportAccessToken(): string { return randomBytes(32).toString("base64url"); }
export function accessTokenHash(token: string): string { return createHmac("sha256", reportAccessTokenSecret()).update(token).digest("hex"); }
export function sessionIndexId(sessionId: string): string { return createHmac("sha256", reportAccessTokenSecret()).update(`session:${sessionId}`).digest("hex"); }
export function matchesAccessTokenHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(accessTokenHash(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
