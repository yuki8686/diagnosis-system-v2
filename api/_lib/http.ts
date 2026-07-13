import type { IncomingMessage, ServerResponse } from "node:http";

export type ApiRequest = IncomingMessage & { method?: string; query?: Record<string, string | string[] | undefined>; body?: unknown };
export type ApiResponse = ServerResponse;

export function json(response: ApiResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(value));
}

export function methodNotAllowed(response: ApiResponse): void { json(response, 405, { error: "Method not allowed" }); }

export async function readJson(request: ApiRequest, maximumBytes = 256_000): Promise<unknown> {
  if (request.body !== undefined && request.body !== null) {
    const serialized = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    if (Buffer.byteLength(serialized, "utf8") > maximumBytes) throw new Error("Request body is too large");
    return typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > maximumBytes) throw new Error("Request body is too large");
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) throw new Error("Request body is required");
  return JSON.parse(raw);
}

export async function readRaw(request: ApiRequest, maximumBytes = 1_000_000): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > maximumBytes) throw new Error("Request body is too large");
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
