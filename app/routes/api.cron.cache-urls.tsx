import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { isCacheCronAuthorized } from "../lib/cache-cron-auth.server";
import { catalogGraphqlPaths, loadCatalogIds } from "../lib/catalog-warm.server";

export const maxDuration = 60;

async function run(request: Request) {
  if (!isCacheCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const catalog = await loadCatalogIds();
  const origin = (
    process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com"
  ).replace(/\/$/, "");
  const urls = catalogGraphqlPaths(catalog).map((path) => `${origin}${path}`);
  return Response.json({
    ok: true,
    collections: catalog.collections.length,
    products: catalog.products.length,
    urls,
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return run(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return run(request);
};
