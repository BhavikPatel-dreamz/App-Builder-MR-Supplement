import type { LoaderFunctionArgs } from "react-router";

import {
  cmsOptionsResponse,
  servePublicSettings,
} from "../lib/settings-public.server";

/**
 * Public shop settings for the native app.
 *
 *   GET https://appbuilder.dreamzapps.com/cms/settings
 *
 * Includes tabBackgroundColor + tabs.
 * Redis L1/L2 + Cache-Control for Cloudflare GET.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return cmsOptionsResponse();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "Use GET /cms/settings." },
      { status: 405 },
    );
  }

  return servePublicSettings(request);
};
