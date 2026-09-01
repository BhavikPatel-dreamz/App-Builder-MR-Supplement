import type { LoaderFunctionArgs } from "react-router";

import {
  cmsOptionsResponse,
  servePublicPageBySlug,
} from "../lib/cms-public.server";

/**
 * Public CMS page by slug for the native app — no App Proxy HMAC.
 *
 *   GET https://appbuilder.dreamzapps.com/cms/pages/{slug}
 *
 * Same JSON as /proxy/pages/{slug}. Redis L1/L2 + Cache-Control for Cloudflare.
 * Optional: ?shop=example.myshopify.com  ?cache=default|bypass|refresh
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return cmsOptionsResponse();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "Use GET /cms/pages/{slug}." },
      { status: 405 },
    );
  }

  return servePublicPageBySlug(request, params.slug);
};
