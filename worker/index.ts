import type { Env } from "./env";
import { checkoutResponse, type CheckoutDependencies } from "./checkout";
import { offerResponse } from "./offer";
import { resultsResponse, type ResultsDependencies } from "./results";
import { webhookResponse, type WebhookDependencies } from "./webhook";

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
  results?: ResultsDependencies;
  webhook?: WebhookDependencies;
}

export async function handleRequest(request: Request, env: Env, dependencies: WorkerDependencies = {}): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/offer") {
    return request.method === "GET" ? offerResponse(env) : offerMethodNotAllowedResponse();
  }
  if (pathname === "/api/results") return await resultsResponse(request, env, dependencies.results);
  if (pathname === "/api/checkout") return await checkoutResponse(request, env, dependencies.checkout);
  if (pathname === "/api/webhook") return await webhookResponse(request, env, dependencies.webhook);
  if (pathname.startsWith("/api/")) return apiNotFoundResponse();
  return await env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
