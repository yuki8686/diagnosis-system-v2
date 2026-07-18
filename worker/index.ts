import type { Env } from "./env";
import { checkoutResponse, type CheckoutDependencies } from "./checkout";
import { offerResponse } from "./offer";

function apiNotFoundResponse(): Response {
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function offerMethodNotAllowedResponse(): Response {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}

export interface WorkerDependencies {
  checkout?: CheckoutDependencies;
}

export async function handleRequest(request: Request, env: Env, dependencies: WorkerDependencies = {}): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/offer") {
    return request.method === "GET" ? offerResponse(env) : offerMethodNotAllowedResponse();
  }
  if (pathname === "/api/checkout") return await checkoutResponse(request, env, dependencies.checkout);
  if (pathname.startsWith("/api/")) return apiNotFoundResponse();
  return await env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
