import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { env } from "../lib/ota/env.server";
import { handleOtaRequest } from "../lib/ota/handler.server";

const API_BASE = "/hot-updater/api";

// Server-side proxy for the embedded OTA dashboard: authenticates the
// Shopify admin, then forwards the request to the /hot-updater/api/*
// management routes with the server-held MANAGEMENT_TOKEN injected. The
// token never reaches the browser.
//
// `shop` is the authenticated session's shop (from authenticate.admin) and is
// passed EXPLICITLY into the handler — never read from a client header — so
// the dashboard can only ever touch its own shop's bundles on the shared DB.
async function proxyRequest(
  request: Request,
  splat: string | undefined,
  shop: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = splat ? `${API_BASE}/${splat}` : API_BASE;

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${env.managementToken}`);

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return handleOtaRequest(new Request(url, init), { shop });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return proxyRequest(request, params["*"], session.shop);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return proxyRequest(request, params["*"], session.shop);
};
