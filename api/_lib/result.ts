import { Timestamp } from "firebase-admin/firestore";
import type { DiagnosisSession } from "../../src/ui/session";
import { firestore } from "./firebase";
import { resultId, sessionIndexId } from "./token";

export type ResultStatus = "awaiting-payment" | "generation-pending" | "paid" | "generation-failed";
export type PublicPurchaseStatus = ResultStatus | "expired";
export interface StoredDiagnosisResult {
  sessionId: string;
  status: ResultStatus;
  diagnosisSnapshot: DiagnosisSession;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  checkoutCreationState?: "creating" | "created" | "failed";
  checkoutCreationStartedAt?: Timestamp;
  expectedPriceId?: string;
  expectedAmount?: number;
  expectedCurrency?: string;
  fulfillmentEventId?: string;
  fulfillmentLeaseExpiresAt?: Timestamp;
  accessTokenHash: string;
  createdAt: Timestamp;
  paidAt?: Timestamp;
  expiresAt: Timestamp;
  answerDataExpiresAt: Timestamp;
  feedbackExpiresAt: Timestamp;
  schemaVersion: 1;
  reportTemplateVersion: string;
  paidReport?: unknown;
}

export function diagnosisSnapshot(session: DiagnosisSession): DiagnosisSession {
  const { freeReport: _freeReport, completionConfirmation: _completionConfirmation, ...snapshot } = session;
  return snapshot;
}

export async function findOrCreateResult(session: DiagnosisSession, tokenHash: string): Promise<{ id: string; created: boolean; status: ResultStatus; tokenUsable: boolean }> {
  const db = firestore();
  const now = Timestamp.now();
  const indexReference = db.collection("diagnosisSessionIndex").doc(sessionIndexId(session.sessionId));
  return db.runTransaction(async (transaction) => {
    const index = await transaction.get(indexReference);
    if (index.exists) {
      const existingId = index.get("resultId");
      if (typeof existingId !== "string") throw new Error("Invalid diagnosis session index");
      const existingReference = db.collection("diagnosisResults").doc(existingId);
      const existing = await transaction.get(existingReference);
      if (!existing.exists) throw new Error("Indexed diagnosis result is missing");
      const value = existing.data() as StoredDiagnosisResult;
      const tokenUsable = value.status === "awaiting-payment" && isUnexpired(value);
      if (tokenUsable) transaction.update(existingReference, { accessTokenHash: tokenHash });
      return { id: existing.id, created: false, status: value.status, tokenUsable };
    }
    const document = db.collection("diagnosisResults").doc(resultId());
    transaction.create(document, { sessionId: session.sessionId, status: "awaiting-payment", diagnosisSnapshot: diagnosisSnapshot(session), accessTokenHash: tokenHash, createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 180 * 24 * 60 * 60 * 1000), answerDataExpiresAt: Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000), feedbackExpiresAt: Timestamp.fromMillis(now.toMillis() + 730 * 24 * 60 * 60 * 1000), schemaVersion: 1, reportTemplateVersion: session.versions.reportTemplateVersion } satisfies StoredDiagnosisResult);
    transaction.create(indexReference, { resultId: document.id, createdAt: now });
    return { id: document.id, created: true, status: "awaiting-payment", tokenUsable: true };
  });
}

export function isUnexpired(result: Pick<StoredDiagnosisResult, "expiresAt">): boolean {
  return result.expiresAt.toMillis() > Date.now();
}
