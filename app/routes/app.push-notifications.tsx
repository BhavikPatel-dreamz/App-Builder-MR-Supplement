import { useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createAndSendPushNotification,
  deletePushNotification,
  listPushNotifications,
  type HistoryResult,
  type PushNotificationInput,
} from "../lib/push-notifications.server";
import { authenticate } from "../shopify.server";
import {
  PushComposer,
  type DuplicateRequest,
  type PushComposerHandle,
} from "../components/push/PushComposer";
import {
  PushHistory,
  type HistoryData,
  type HistoryItem,
  type HistoryParams,
} from "../components/push/PushHistory";
import { ToastStack, useToasts } from "../components/push/toast";
import { AppTabBar, useAppTab } from "../components/AppTabBar";
import pushStyles from "../styles/push-notifications.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: pushStyles },
];

const EMPTY_HISTORY: HistoryData = {
  items: [],
  total: 0,
  page: 1,
  pages: 1,
  counts: { all: 0, sent: 0, failed: 0 },
};

function parseParams(url: URL): HistoryParams {
  const page = Number(url.searchParams.get("page") || "1");
  const status = url.searchParams.get("status") || "all";
  const sort = url.searchParams.get("sort") === "asc" ? "asc" : "desc";
  return {
    q: url.searchParams.get("q") || "",
    status: status === "sent" || status === "failed" ? status : "all",
    sort,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/** Prisma returns Date objects — serialize to ISO strings for the wire. */
function serializeHistory(result: HistoryResult): HistoryData {
  return {
    total: result.total,
    page: result.page,
    pages: result.pages,
    counts: result.counts,
    items: result.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      sentAt: item.sentAt ? item.sentAt.toISOString() : null,
    })),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const params = parseParams(url);

  try {
    const result = await listPushNotifications(session.shop, {
      page: params.page,
      pageSize: 6,
      status: params.status,
      q: params.q,
      sort: params.sort,
    });
    return { history: serializeHistory(result), params, loadError: null };
  } catch (error) {
    console.error("[push] history load failed:", error);
    return {
      history: EMPTY_HISTORY,
      params,
      loadError: "Failed to load notification history.",
    };
  }
};

/**
 * Page action: same operations as the resource routes, reachable via a plain
 * form post (intent=send | intent=delete). The React UI calls the resource
 * routes directly for richer error handling.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let intent = "";
  let payload: Record<string, unknown> = {};
  try {
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      intent = String(body.intent || "");
      payload = body;
    } else {
      const form = await request.formData();
      intent = String(form.get("intent") || "");
      payload = Object.fromEntries(form.entries());
    }
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (intent === "send") {
    const input: PushNotificationInput = {
      title: String(payload.title ?? ""),
      message: String(payload.message ?? ""),
      imageUrl: payload.imageUrl ? String(payload.imageUrl) : undefined,
      imageName: payload.imageName ? String(payload.imageName) : undefined,
      deeplink: payload.deeplink ? String(payload.deeplink) : "",
      deviceToken: payload.deviceToken ? String(payload.deviceToken) : undefined,
    };
    const imageSize = Number(payload.imageSize);
    if (Number.isFinite(imageSize) && imageSize > 0) {
      input.imageSize = imageSize;
    }
    try {
      const outcome = await createAndSendPushNotification(session.shop, input, {
        idempotencyKey: payload.idempotencyKey
          ? String(payload.idempotencyKey)
          : undefined,
      });
      // Always HTTP 200 so Cloudflare error pages never replace the JSON
      // (a 502 from origin is shown as the "Bad gateway" interstitial).
      return Response.json(outcome);
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
  }

  if (intent === "delete") {
    const id = String(payload.id ?? "");
    if (!id) {
      return Response.json({ ok: false, error: "Missing id." });
    }
    try {
      const deleted = await deletePushNotification(session.shop, id);
      return Response.json(
        deleted
          ? { ok: true, id }
          : { ok: false, error: "Notification not found." },
      );
    } catch (error) {
      console.error("[push] delete crashed:", error);
      return Response.json({
        ok: false,
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Failed to delete notification.",
      });
    }
  }

  return Response.json({ ok: false, error: "Unknown intent." }, { status: 400 });
};

export default function PushNotificationsPage() {
  const { history, params, loadError } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [, setSearchParams] = useSearchParams();
  const { toast, toasts, dismiss } = useToasts();
  const [tab, setTab] = useAppTab("compose");
  const composerRef = useRef<PushComposerHandle>(null);

  const [duplicateRequest, setDuplicateRequest] = useState<DuplicateRequest | null>(
    null,
  );

  const loading =
    navigation.state !== "idle" ||
    revalidator.state !== "idle";

  /** Patch history params into the URL; the loader refetches. */
  const onChange = (patch: Partial<HistoryParams>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (patch.q !== undefined) next.set("q", patch.q);
        if (patch.status !== undefined) next.set("status", patch.status);
        if (patch.sort !== undefined) next.set("sort", patch.sort);
        if (patch.page !== undefined) next.set("page", String(patch.page));
        return next;
      },
      // Typing search shouldn't spam browser history or scroll the page.
      { replace: patch.page === undefined, preventScrollReset: true },
    );
  };

  const onDuplicate = (item: HistoryItem) => {
    setDuplicateRequest({
      nonce: Date.now(),
      title: item.title,
      message: item.message,
      deeplink: item.deeplink || "",
      imageUrl: item.imageUrl,
      imageName: item.imageName,
      imageSize: item.imageSize,
    });
  };

  return (
    <s-page heading="Push Notifications">
      {tab === "compose" ? (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => composerRef.current?.requestSend()}
        >
          Send notification
        </s-button>
      ) : null}

      <s-section>
        <AppTabBar
          value={tab}
          onChange={(id) => {
            setTab(id);
            if (id === "history") revalidator.revalidate();
          }}
          tabs={[
            { id: "compose", label: "Compose" },
            { id: "history", label: "History" },
          ]}
        />
      </s-section>

      {tab === "compose" ? (
        <s-section heading="Create notification">
          <PushComposer
            ref={composerRef}
            onSent={() => {
              revalidator.revalidate();
              setTab("history");
            }}
            toast={toast}
            duplicateRequest={duplicateRequest}
            onDuplicateHandled={() => setDuplicateRequest(null)}
          />
        </s-section>
      ) : (
        <s-section heading="Notification history">
          <PushHistory
            data={history || EMPTY_HISTORY}
            params={params}
            loading={loading}
            error={loadError}
            onChange={onChange}
            onRefresh={() => revalidator.revalidate()}
            onDuplicate={(item) => {
              onDuplicate(item);
              setTab("compose");
            }}
            toast={toast}
          />
        </s-section>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

