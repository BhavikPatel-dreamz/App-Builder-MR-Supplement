import type { LoaderFunctionArgs } from "react-router";

import { getPublishedPageBySlug } from "../lib/cms.server";
import { authenticate } from "../shopify.server";

/**
 * Signed App Proxy endpoint for the mobile app.
 *
 * Storefront URL: https://{shop}.myshopify.com/apps/cms/pages/{slug}
 * Returns a single published page including the rendered block HTML and
 * SEO metadata, ready for the mobile client to render.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const shop =
    session?.shop ?? new URL(request.url).searchParams.get("shop") ?? "";

  const slug = params.slug;

  if (!shop) {
    return Response.json({ error: "Shop could not be resolved." }, { status: 400 });
  }

  if (!slug) {
    return Response.json({ error: "Page slug is required." }, { status: 400 });
  }

  const page = await getPublishedPageBySlug(shop, slug);

  if (!page) {
    return Response.json({ error: "Page not found." }, { status: 404 });
  }

  return Response.json(page, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
};
