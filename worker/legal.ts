import { legalConfigurationIsComplete } from "../src/sales-configuration";
import type { Env } from "./env";

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Returns only the public legal-configuration state used by the legacy API. */
export function legalResponse(request: Request, env: Env): Response {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  return jsonResponse(200, { configured: legalConfigurationIsComplete(env) });
}
