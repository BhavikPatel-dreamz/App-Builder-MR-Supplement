import type { LoaderFunctionArgs } from "react-router";

import {
  cmsOptionsResponse,
  servePublicPageList,
} from "../lib/cms-public.server";

/**
 * Public CMS page list for the native app.
 *
 *   GET https://appbuilder.dreamzapps.com/cms/pages
 *
 * Redis L1/L2 + Cache-Control for Cloudflare GET.
 * Optional: ?shop=example.myshopify.com  ?cache=default|bypass|refresh
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return cmsOptionsResponse();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "Use GET /cms/pages (or GET /cms/pages/{slug})." },
      { status: 405 },
    );
  }

  return servePublicPageList(request);
};
