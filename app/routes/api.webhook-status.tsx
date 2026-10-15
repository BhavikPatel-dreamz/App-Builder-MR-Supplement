import type { LoaderFunctionArgs } from "react-router";

import { isCacheCronAuthorized } from "../lib/cache-cron-auth.server";
import { readWebhookStatus } from "../lib/protection/webhook-invalidation.server";

/** Debug: read the last catalog-webhook breadcrumb (Redis-backed). */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!isCacheCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await readWebhookStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
};
