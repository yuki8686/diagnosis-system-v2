import type { Env } from "./env";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIRESTORE_DATABASE = "(default)";
const CHECKOUT_LEASE_MS = 5 * 60 * 1000;
const TRANSACTION_ATTEMPTS = 5;
const MAX_EXTERNAL_RESPONSE_BYTES = 64 * 1024;

export interface CheckoutInput {
  resultId: string;
  accessToken: string;
}

export interface ExpectedCheckout {
  priceId: string;
  amount: number;
  currency: string;
}

export interface CheckoutReservation {
  documentName: string;
}

export interface CheckoutStore {
  reserve(input: CheckoutInput, expected: ExpectedCheckout): Promise<CheckoutReservation>;
  saveCheckoutSession(reservation: CheckoutReservation, sessionId: string): Promise<void>;
  markCheckoutFailed(reservation: CheckoutReservation): Promise<void>;
}

export interface ResultSeed {
  sessionId: string;
  diagnosisSnapshot: Record<string, unknown>;
  accessTokenHash: string;
  reportTemplateVersion: string;
}

export interface StoredResult {
  id: string;
  tokenUsable: boolean;
}

export interface ResultStore {
  findOrCreate(seed: ResultSeed): Promise<StoredResult>;
}

export interface WebhookCheckout {
  eventId: string;
  eventType: string;
  checkoutSessionId: string;
  resultId: string;
  paymentIntentId?: string;
  paymentStatus: string;
  mode: string;
  currency: string;
  amountTotal: number;
  priceIds: string[];
}

export interface WebhookStore {
  settle(checkout: WebhookCheckout): Promise<"complete" | "ignored">;
}

export type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class CheckoutRejectedError extends Error {
  constructor() {
    super("checkout-rejected");
  }
}

class FirestoreRequestError extends Error {
  constructor(readonly retryable: boolean) {
    super("firestore-request-failed");
  }
}

interface FirestoreMapValue {
  fields?: Record<string, FirestoreValue>;
}

interface FirestoreArrayValue {
  values?: FirestoreValue[];
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
  booleanValue?: boolean;
  doubleValue?: number;
  nullValue?: null;
  mapValue?: FirestoreMapValue;
  arrayValue?: FirestoreArrayValue;
}

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
}

interface FirestoreBatchGetResponse {
  found?: FirestoreDocument;
  missing?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function privateKeyBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("\\n", "\n").trim();
  const base64 = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/gu, "");
  if (!base64) throw new FirestoreRequestError(false);
  try {
    return decodeBase64(base64);
  } catch {
    throw new FirestoreRequestError(false);
  }
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EXTERNAL_RESPONSE_BYTES) throw new FirestoreRequestError(false);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_EXTERNAL_RESPONSE_BYTES) {
        await reader.cancel();
        throw new FirestoreRequestError(false);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await readLimitedText(response);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FirestoreRequestError(false);
  }
}

async function accessTokenHash(token: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
}

function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function accessTokenHashHex(token: string, secret: string): Promise<string> {
  return hexString(await accessTokenHash(token, secret));
}

export function createReportAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function hexBytes(value: string): Uint8Array | undefined {
  if (!/^[0-9a-f]{64}$/iu.test(value)) return undefined;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

export async function matchesAccessTokenHash(token: string, expectedHash: string, secret: string): Promise<boolean> {
  const expected = hexBytes(expectedHash);
  if (!expected) return false;
  const actual = await accessTokenHash(token, secret);
  let difference = actual.length ^ expected.length;
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  return difference === 0;
}

async function sessionIndexId(sessionId: string, secret: string): Promise<string> {
  return await accessTokenHashHex(`session:${sessionId}`, secret);
}

async function serviceAccessToken(env: Env, fetchImplementation: FetchImplementation, now: () => number): Promise<string> {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !privateKey) throw new FirestoreRequestError(false);
  const issuedAt = Math.floor(now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  })));
  const signingInput = `${header}.${claims}`;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      exactArrayBuffer(privateKeyBytes(privateKey)),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new FirestoreRequestError(false);
  }
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput)));
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${signingInput}.${base64Url(signature)}`,
  });
  let response: Response;
  try {
    response = await fetchImplementation("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new FirestoreRequestError(true);
  }
  if (!response.ok) throw new FirestoreRequestError(response.status >= 500 || response.status === 429);
  const payload = await readJson(response);
  if (!isRecord(payload) || typeof payload.access_token !== "string" || !payload.access_token) throw new FirestoreRequestError(false);
  return payload.access_token;
}

function stringField(document: FirestoreDocument, name: string): string | undefined {
  return document.fields?.[name]?.stringValue;
}

function timestampField(document: FirestoreDocument, name: string): number | undefined {
  const value = document.fields?.[name]?.timestampValue;
  if (!value) return undefined;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function integerField(document: FirestoreDocument, name: string): number | undefined {
  const value = document.fields?.[name]?.integerValue;
  if (!value || !/^-?\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function checkoutDocumentName(projectId: string, resultId: string): string {
  return `projects/${projectId}/databases/${FIRESTORE_DATABASE}/documents/diagnosisResults/${resultId}`;
}

function timestampValue(now: number): FirestoreValue {
  return { timestampValue: new Date(now).toISOString() };
}

function updateWrite(documentName: string, fields: Record<string, FirestoreValue>, updateTime?: string): Record<string, unknown> {
  return {
    update: { name: documentName, fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: updateTime ? { updateTime } : { exists: true },
  };
}

function createWrite(documentName: string, fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return { update: { name: documentName, fields }, currentDocument: { exists: false } };
}

function firestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new FirestoreRequestError(false);
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (isRecord(value)) {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) fields[key] = firestoreValue(nested);
    }
    return { mapValue: { fields } };
  }
  throw new FirestoreRequestError(false);
}

export function createResultDocumentFields(seed: ResultSeed, createdAt: number): Record<string, FirestoreValue> {
  return {
    sessionId: { stringValue: seed.sessionId },
    status: { stringValue: "awaiting-payment" },
    diagnosisSnapshot: firestoreValue(seed.diagnosisSnapshot),
    accessTokenHash: { stringValue: seed.accessTokenHash },
    createdAt: timestampValue(createdAt),
    expiresAt: timestampValue(createdAt + 180 * 24 * 60 * 60 * 1000),
    answerDataExpiresAt: timestampValue(createdAt + 30 * 24 * 60 * 60 * 1000),
    feedbackExpiresAt: timestampValue(createdAt + 730 * 24 * 60 * 60 * 1000),
    schemaVersion: { integerValue: "1" },
    reportTemplateVersion: { stringValue: seed.reportTemplateVersion },
  };
}

function firestoreDocumentName(projectId: string, collection: string, id: string): string {
  return `projects/${projectId}/databases/${FIRESTORE_DATABASE}/documents/${collection}/${id}`;
}

export function createFirestoreCheckoutStore(env: Env, fetchImplementation: FetchImplementation = fetch, now: () => number = Date.now): CheckoutStore {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new FirestoreRequestError(false);
  let tokenPromise: Promise<string> | undefined;
  const token = (): Promise<string> => {
    tokenPromise ??= serviceAccessToken(env, fetchImplementation, now);
    return tokenPromise;
  };
  const apiUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE}/documents`;

  async function firestoreRequest(path: string, body: Record<string, unknown>): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImplementation(`${apiUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new FirestoreRequestError(true);
    }
    if (!response.ok) throw new FirestoreRequestError(response.status === 409 || response.status >= 500 || response.status === 429);
    return response;
  }

  async function beginTransaction(): Promise<string> {
    const response = await firestoreRequest(":beginTransaction", {});
    const payload = await readJson(response);
    if (!isRecord(payload) || typeof payload.transaction !== "string" || !payload.transaction) throw new FirestoreRequestError(false);
    return payload.transaction;
  }

  async function getDocument(transaction: string, documentName: string): Promise<FirestoreDocument | undefined> {
    const response = await firestoreRequest(":batchGet", { documents: [documentName], transaction });
    const text = await readLimitedText(response);
    const lines = text.split(/\r?\n/u).filter(Boolean);
    if (lines.length !== 1) throw new FirestoreRequestError(false);
    let payload: unknown;
    try {
      payload = JSON.parse(lines[0]) as unknown;
    } catch {
      throw new FirestoreRequestError(false);
    }
    if (!isRecord(payload)) throw new FirestoreRequestError(false);
    if (typeof payload.missing === "string") return undefined;
    const found = payload.found;
    if (!isRecord(found)) throw new FirestoreRequestError(false);
    return found as FirestoreDocument;
  }

  async function commit(writes: Record<string, unknown>[], transaction?: string): Promise<void> {
    const response = await firestoreRequest(":commit", transaction ? { writes, transaction } : { writes });
    await readJson(response);
  }

  return {
    async reserve(input, expected): Promise<CheckoutReservation> {
      const documentName = checkoutDocumentName(projectId, input.resultId);
      for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt += 1) {
        const transaction = await beginTransaction();
        const document = await getDocument(transaction, documentName);
        if (!document || document.name !== documentName) throw new CheckoutRejectedError();
        const accessTokenHash = stringField(document, "accessTokenHash");
        const expiresAt = timestampField(document, "expiresAt");
        const creationStartedAt = timestampField(document, "checkoutCreationStartedAt");
        const creationLeaseActive = stringField(document, "checkoutCreationState") === "creating"
          && creationStartedAt !== undefined
          && creationStartedAt > now() - CHECKOUT_LEASE_MS;
        const validToken = accessTokenHash !== undefined
          && await matchesAccessTokenHash(input.accessToken, accessTokenHash, env.REPORT_ACCESS_TOKEN_SECRET ?? "");
        if (!validToken
          || stringField(document, "status") !== "awaiting-payment"
          || expiresAt === undefined
          || expiresAt <= now()
          || creationLeaseActive
          || Boolean(stringField(document, "stripeCheckoutSessionId"))) throw new CheckoutRejectedError();
        const fields: Record<string, FirestoreValue> = {
          checkoutCreationState: { stringValue: "creating" },
          checkoutCreationStartedAt: timestampValue(now()),
          expectedPriceId: { stringValue: expected.priceId },
          expectedAmount: { integerValue: String(expected.amount) },
          expectedCurrency: { stringValue: expected.currency },
        };
        try {
          await commit([updateWrite(documentName, fields, document.updateTime)], transaction);
          return { documentName };
        } catch (error) {
          if (error instanceof FirestoreRequestError && error.retryable && attempt + 1 < TRANSACTION_ATTEMPTS) continue;
          throw error;
        }
      }
      throw new FirestoreRequestError(true);
    },
    async saveCheckoutSession(reservation, sessionId): Promise<void> {
      await commit([updateWrite(reservation.documentName, {
        stripeCheckoutSessionId: { stringValue: sessionId },
        checkoutCreationState: { stringValue: "created" },
      })]);
    },
    async markCheckoutFailed(reservation): Promise<void> {
      await commit([updateWrite(reservation.documentName, { checkoutCreationState: { stringValue: "failed" } })]);
    },
  };
}

/**
 * Mirrors the Vercel `findOrCreateResult` transaction.  The session index is
 * authoritative for idempotency; a generated result ID is never written over
 * an existing document because both writes use `exists: false` preconditions.
 */
export function createFirestoreResultStore(
  env: Env,
  fetchImplementation: FetchImplementation = fetch,
  now: () => number = Date.now,
  nextResultId: () => string = () => crypto.randomUUID(),
): ResultStore {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const tokenSecret = env.REPORT_ACCESS_TOKEN_SECRET?.trim();
  if (!projectId || !tokenSecret) throw new FirestoreRequestError(false);
  let tokenPromise: Promise<string> | undefined;
  const token = (): Promise<string> => {
    tokenPromise ??= serviceAccessToken(env, fetchImplementation, now);
    return tokenPromise;
  };
  const apiUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE}/documents`;

  async function firestoreRequest(path: string, body: Record<string, unknown>): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImplementation(`${apiUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new FirestoreRequestError(true);
    }
    if (!response.ok) throw new FirestoreRequestError(response.status === 409 || response.status >= 500 || response.status === 429);
    return response;
  }

  async function beginTransaction(): Promise<string> {
    const response = await firestoreRequest(":beginTransaction", {});
    const payload = await readJson(response);
    if (!isRecord(payload) || typeof payload.transaction !== "string" || !payload.transaction) throw new FirestoreRequestError(false);
    return payload.transaction;
  }

  async function getDocument(transaction: string, documentName: string): Promise<FirestoreDocument | undefined> {
    const response = await firestoreRequest(":batchGet", { documents: [documentName], transaction });
    const text = await readLimitedText(response);
    const lines = text.split(/\r?\n/u).filter(Boolean);
    if (lines.length !== 1) throw new FirestoreRequestError(false);
    let payload: unknown;
    try {
      payload = JSON.parse(lines[0]) as unknown;
    } catch {
      throw new FirestoreRequestError(false);
    }
    if (!isRecord(payload)) throw new FirestoreRequestError(false);
    if (typeof payload.missing === "string") return undefined;
    const found = payload.found;
    if (!isRecord(found)) throw new FirestoreRequestError(false);
    return found as FirestoreDocument;
  }

  async function commit(writes: Record<string, unknown>[], transaction: string): Promise<void> {
    const response = await firestoreRequest(":commit", { writes, transaction });
    await readJson(response);
  }

  return {
    async findOrCreate(seed): Promise<StoredResult> {
      const indexId = await sessionIndexId(seed.sessionId, tokenSecret);
      const indexName = firestoreDocumentName(projectId, "diagnosisSessionIndex", indexId);
      for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt += 1) {
        const transaction = await beginTransaction();
        const index = await getDocument(transaction, indexName);
        if (index) {
          const existingId = stringField(index, "resultId");
          if (!existingId) throw new FirestoreRequestError(false);
          const existingName = firestoreDocumentName(projectId, "diagnosisResults", existingId);
          const existing = await getDocument(transaction, existingName);
          if (!existing || existing.name !== existingName) throw new FirestoreRequestError(false);
          const expiresAt = timestampField(existing, "expiresAt");
          const tokenUsable = stringField(existing, "status") === "awaiting-payment" && expiresAt !== undefined && expiresAt > now();
          if (tokenUsable) {
            try {
              await commit([updateWrite(existingName, { accessTokenHash: { stringValue: seed.accessTokenHash } }, existing.updateTime)], transaction);
            } catch (error) {
              if (error instanceof FirestoreRequestError && error.retryable && attempt + 1 < TRANSACTION_ATTEMPTS) continue;
              throw error;
            }
          }
          return { id: existingId, tokenUsable };
        }
        const resultId = nextResultId();
        if (!/^[0-9a-f-]{36}$/iu.test(resultId)) throw new FirestoreRequestError(false);
        const resultName = firestoreDocumentName(projectId, "diagnosisResults", resultId);
        const createdAt = now();
        try {
          await commit([
            createWrite(resultName, createResultDocumentFields(seed, createdAt)),
            createWrite(indexName, { resultId: { stringValue: resultId }, createdAt: timestampValue(createdAt) }),
          ], transaction);
          return { id: resultId, tokenUsable: true };
        } catch (error) {
          if (error instanceof FirestoreRequestError && error.retryable && attempt + 1 < TRANSACTION_ATTEMPTS) continue;
          throw error;
        }
      }
      throw new FirestoreRequestError(true);
    },
  };
}

/** Applies the payment-confirmed, pre-report state used by the Vercel webhook. */
export function createFirestoreWebhookStore(env: Env, fetchImplementation: FetchImplementation = fetch, now: () => number = Date.now): WebhookStore {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new FirestoreRequestError(false);
  let tokenPromise: Promise<string> | undefined;
  const token = (): Promise<string> => {
    tokenPromise ??= serviceAccessToken(env, fetchImplementation, now);
    return tokenPromise;
  };
  const apiUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE}/documents`;
  async function request(path: string, body: Record<string, unknown>): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImplementation(`${apiUrl}${path}`, { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch { throw new FirestoreRequestError(true); }
    if (!response.ok) throw new FirestoreRequestError(response.status === 409 || response.status >= 500 || response.status === 429);
    return response;
  }
  async function begin(): Promise<string> {
    const payload = await readJson(await request(":beginTransaction", {}));
    if (!isRecord(payload) || typeof payload.transaction !== "string" || !payload.transaction) throw new FirestoreRequestError(false);
    return payload.transaction;
  }
  async function get(transaction: string, name: string): Promise<FirestoreDocument | undefined> {
    const text = await readLimitedText(await request(":batchGet", { documents: [name], transaction }));
    const lines = text.split(/\r?\n/u).filter(Boolean);
    if (lines.length !== 1) throw new FirestoreRequestError(false);
    let payload: unknown;
    try { payload = JSON.parse(lines[0]) as unknown; } catch { throw new FirestoreRequestError(false); }
    if (!isRecord(payload)) throw new FirestoreRequestError(false);
    if (typeof payload.missing === "string") return undefined;
    return isRecord(payload.found) ? payload.found as FirestoreDocument : undefined;
  }
  async function commit(writes: Record<string, unknown>[], transaction: string): Promise<void> {
    await readJson(await request(":commit", { writes, transaction }));
  }
  return {
    async settle(checkout): Promise<"complete" | "ignored"> {
      const eventName = firestoreDocumentName(projectId, "stripeEvents", checkout.eventId);
      const resultName = firestoreDocumentName(projectId, "diagnosisResults", checkout.resultId);
      for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt += 1) {
        const transaction = await begin();
        const event = await get(transaction, eventName);
        if (event && timestampField(event, "processedAt") !== undefined) return "complete";
        if (event && (timestampField(event, "leaseExpiresAt") ?? 0) > now()) return "ignored";
        const result = await get(transaction, resultName);
        if (!result || result.name !== resultName) return "ignored";
        const status = stringField(result, "status");
        const storedSessionId = stringField(result, "stripeCheckoutSessionId");
        if (status === "paid") {
          if (storedSessionId !== checkout.checkoutSessionId) return "ignored";
          await commit([{
            update: { name: eventName, fields: { kind: { stringValue: checkout.eventType }, checkoutSessionId: { stringValue: checkout.checkoutSessionId }, status: { stringValue: "processed" }, processedAt: timestampValue(now()) } },
            updateMask: { fieldPaths: ["kind", "checkoutSessionId", "status", "processedAt"] },
          }], transaction);
          return "complete";
        }
        if (status === "generation-pending") {
          if (stringField(result, "fulfillmentEventId") !== checkout.eventId || storedSessionId !== checkout.checkoutSessionId) return "ignored";
          await commit([{
            update: { name: eventName, fields: { kind: { stringValue: checkout.eventType }, checkoutSessionId: { stringValue: checkout.checkoutSessionId }, status: { stringValue: "processed" }, processedAt: timestampValue(now()) } },
            updateMask: { fieldPaths: ["kind", "checkoutSessionId", "status", "processedAt"] },
          }], transaction);
          return "complete";
        }
        const expectedPriceId = stringField(result, "expectedPriceId");
        const expectedAmount = integerField(result, "expectedAmount");
        const expectedCurrency = stringField(result, "expectedCurrency");
        if (status !== "awaiting-payment"
          || (timestampField(result, "expiresAt") ?? 0) <= now()
          || storedSessionId !== checkout.checkoutSessionId
          || !expectedPriceId
          || expectedAmount === undefined
          || !expectedCurrency
          || checkout.paymentStatus !== "paid"
          || checkout.mode !== "payment"
          || checkout.currency !== expectedCurrency
          || checkout.amountTotal !== expectedAmount
          || checkout.priceIds.length !== 1
          || checkout.priceIds[0] !== expectedPriceId) return "ignored";
        const paidAt = now();
        const leaseExpiresAt = paidAt + CHECKOUT_LEASE_MS;
        const resultFields: Record<string, FirestoreValue> = {
          status: { stringValue: "generation-pending" },
          fulfillmentEventId: { stringValue: checkout.eventId },
          fulfillmentLeaseExpiresAt: timestampValue(leaseExpiresAt),
          paidAt: timestampValue(paidAt),
          expiresAt: timestampValue(paidAt + 180 * 24 * 60 * 60 * 1000),
          answerDataExpiresAt: timestampValue(paidAt + 30 * 24 * 60 * 60 * 1000),
          feedbackExpiresAt: timestampValue(paidAt + 730 * 24 * 60 * 60 * 1000),
        };
        if (checkout.paymentIntentId) resultFields.stripePaymentIntentId = { stringValue: checkout.paymentIntentId };
        const eventFields: Record<string, FirestoreValue> = { kind: { stringValue: checkout.eventType }, checkoutSessionId: { stringValue: checkout.checkoutSessionId }, status: { stringValue: "processed" }, processedAt: timestampValue(paidAt) };
        try {
          await commit([
            updateWrite(resultName, resultFields, result.updateTime),
            { update: { name: eventName, fields: eventFields }, updateMask: { fieldPaths: Object.keys(eventFields) } },
          ], transaction);
          return "complete";
        } catch (error) {
          if (error instanceof FirestoreRequestError && error.retryable && attempt + 1 < TRANSACTION_ATTEMPTS) continue;
          throw error;
        }
      }
      throw new FirestoreRequestError(true);
    },
  };
}
