import type { Env } from "./env";
import { offerResponse } from "./offer";

function apiNotFoundResponse(): Response {
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function methodNotAllowedResponse(): Response {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/offer") {
    return request.method === "GET" ? offerResponse(env) : methodNotAllowedResponse();
  }
  if (pathname.startsWith("/api/")) return apiNotFoundResponse();
  return await env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
