import type { LoaderFunctionArgs } from "react-router";

import { listPushNotifications } from "../lib/push-notifications.server";
import { authenticate } from "../shopify.server";

/**
 * GET /api/push/history?page=1&pageSize=6&status=all|sent|failed&q=&sort=asc|desc
 * Returns filtered, searched, paginated history plus filter chip counts.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "6");
  const status = url.searchParams.get("status") || "all";
  const q = url.searchParams.get("q") || "";
  const sort = url.searchParams.get("sort") === "asc" ? "asc" : "desc";

  try {
    const result = await listPushNotifications(session.shop, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 6,
      status,
      q,
      sort,
    });
    return Response.json(result);
  } catch (error) {
    console.error("[push] history load failed:", error);
    return Response.json(
      { error: "Failed to load notification history." },
      { status: 500 },
    );
  }
};
