import type { ActionFunctionArgs } from "react-router";

import {
  createAndSendPushNotification,
  type PushNotificationInput,
} from "../lib/push-notifications.server";
import { authenticate } from "../shopify.server";

/**
 * POST /api/push/send
 * Server-side validated send. Creates a "pending" row, calls the push API,
 * then flips it to "sent"/"failed". Accepts an `Idempotency-Key` header (or
 * `idempotencyKey` in the body) so retries never double-send.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, status: "invalid", error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const input: PushNotificationInput = {
    title: String(body.title ?? ""),
    message: String(body.message ?? ""),
    imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
    imageName: body.imageName ? String(body.imageName) : undefined,
    imageSize:
      typeof body.imageSize === "number" && Number.isFinite(body.imageSize)
        ? body.imageSize
        : undefined,
    deeplink: body.deeplink ? String(body.deeplink) : "",
    deviceToken: body.deviceToken ? String(body.deviceToken) : undefined,
  };

  const idempotencyKey =
    request.headers.get("Idempotency-Key") ||
    (body.idempotencyKey ? String(body.idempotencyKey) : "");

  try {
    const outcome = await createAndSendPushNotification(session.shop, input, {
      idempotencyKey: idempotencyKey || undefined,
    });

    // HTTP 200 even when FCM failed — Cloudflare's 502 error page would
    // replace JSON with the "Bad gateway" HTML interstitial.
    if (outcome.ok) {
      return Response.json({ ok: true, id: outcome.id, status: outcome.status });
    }
    return Response.json({
      ok: false,
      id: outcome.id,
      status: outcome.status,
      error: outcome.error,
      fields: outcome.fields,
      recorded: outcome.recorded,
    });
  } catch (error) {
    console.error("[push] send crashed:", error);
    return Response.json({
      ok: false,
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Send failed unexpectedly.",
    });
  }
};
