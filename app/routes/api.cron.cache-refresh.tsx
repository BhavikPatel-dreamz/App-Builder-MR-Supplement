import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { isCacheCronAuthorized } from "../lib/cache-cron-auth.server";
import { warmCatalogRedisBatch } from "../lib/catalog-warm.server";
import { warmEveryShop } from "../lib/cache-store.server";

export const maxDuration = 300;

async function runCron(request: Request) {
  if (!isCacheCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const result = await warmEveryShop();
  const catalog = await warmCatalogRedisBatch();
  return Response.json({
    ok: true,
    shops: result.shops,
    registered: result.registered,
    catalog,
    durationMs: Date.now() - started,
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return runCron(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return runCron(request);
};
