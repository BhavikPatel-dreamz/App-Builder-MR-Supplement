import type { LoaderFunctionArgs } from "react-router";

import { listPublishedPages } from "../lib/cms.server";
import { authenticate } from "../shopify.server";

/**
 * Signed App Proxy endpoint for the mobile app.
 *
 * Storefront URL: https://{shop}.myshopify.com/apps/cms/pages
 * Returns the list of published pages as JSON (no block HTML, kept light
 * for a list/index screen). Fetch a single page for its full content.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const shop =
    session?.shop ?? new URL(request.url).searchParams.get("shop") ?? "";

  if (!shop) {
    return Response.json({ error: "Shop could not be resolved." }, { status: 400 });
  }

  const pages = await listPublishedPages(shop);

  return Response.json(
    {
      success: true,
      pages,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
};
