import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { handleOtaRequest } from "../lib/ota/handler.server";

const API_BASE = "/hot-updater/api";

// Server-side proxy for the embedded OTA dashboard. Trusts the Shopify admin
// session (authenticate.admin) — not MANAGEMENT_TOKEN. On Vercel the dashboard
// fetch often cannot deliver a Bearer management header (the incoming header
// is App Bridge's session JWT, and an injected MANAGEMENT_TOKEN is frequently
// stripped on the internal Request rewrite).
//
// `shop` is the authenticated session's shop and is passed EXPLICITLY into
// the handler — never read from a client header — so the dashboard can only
// ever touch its own shop's bundles on the shared DB. CLI /hot-updater
// uploads still authenticate with MANAGEMENT_TOKEN.
async function proxyRequest(
  request: Request,
  splat: string | undefined,
  shop: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = splat ? `${API_BASE}/${splat}` : API_BASE;

  const headers = new Headers(request.headers);
  // Incoming Authorization is the Shopify session JWT. Do not forward it
  // (hot-updater would treat it as MANAGEMENT_TOKEN) and do not replace it
  // with MANAGEMENT_TOKEN — this path is already admin-authenticated.
  headers.delete("Authorization");

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return handleOtaRequest(new Request(url, init), {
    shop,
    skipManagementToken: true,
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return proxyRequest(request, params["*"], session.shop);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return proxyRequest(request, params["*"], session.shop);
};
