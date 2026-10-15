import type { ActionFunctionArgs } from "react-router";

import { deletePushNotification } from "../lib/push-notifications.server";
import { authenticate } from "../shopify.server";

/**
 * DELETE /api/push/:id
 * Removes a history row only when it belongs to this shop.
 * Note: this does not recall an already-delivered notification from devices.
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "DELETE") {
    return Response.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);
  const id = params.id || "";

  if (!id) {
    return Response.json({ ok: false, error: "Missing notification id." }, { status: 400 });
  }

  try {
    const deleted = await deletePushNotification(session.shop, id);
    if (!deleted) {
      return Response.json(
        { ok: false, error: "Notification not found." },
        { status: 404 },
      );
    }
    return Response.json({ ok: true, id });
  } catch (error) {
    console.error("[push] delete failed:", error);
    return Response.json(
      { ok: false, error: "Failed to delete notification." },
      { status: 500 },
    );
  }
};
