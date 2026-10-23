import db from "../db.server";
import { getRedisClient } from "./redis-cache.server";
import { sendPush } from "../services/push.server";
import { validatePushInput, type PushFieldErrors } from "./push-validation";

export type PushNotificationStatus = "pending" | "sent" | "failed";

export type PushNotificationInput = {
  title: string;
  message: string;
  imageUrl?: string;
  imageName?: string;
  imageSize?: number;
  deeplink?: string;
  /** Optional FCM registration token — test send to one device. Not stored. */
  deviceToken?: string;
};

export type PushNotification = {
  id: string;
  shop: string;
  title: string;
  message: string;
  imageUrl: string | null;
  imageName: string | null;
  imageSize: number | null;
  deeplink: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

/* ------------------------------------------------------------------ */
/* Rate limiting — 10 sends / minute / shop                           */
/* ------------------------------------------------------------------ */

const RATE_LIMIT = 10;
const localCounters = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window counter; Redis when available, per-process fallback otherwise. */
async function underRateLimit(shop: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `rl:push:send:${shop}:${bucket}`;
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 90);
      return count <= RATE_LIMIT;
    } catch {
      /* fall through to local counter */
    }
  }
  const now = Date.now();
  const entry = localCounters.get(key);
  if (!entry || entry.resetAt <= now) {
    localCounters.set(key, { count: 1, resetAt: now + 60_000 });
    if (localCounters.size > 500) localCounters.clear(); // bound memory
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT;
}

/* ------------------------------------------------------------------ */
/* Idempotency — one key maps to one response within the TTL           */
/* ------------------------------------------------------------------ */

const IDEM_TTL_SECONDS = 600;
const localIdempotency = new Map<string, { body: string; expiresAt: number }>();

async function idempotentGet(shop: string, key: string): Promise<string | null> {
  const redisKey = `push:idem:${shop}:${key}`;
  const redis = getRedisClient();
  if (redis) {
    try {
      return await redis.get(redisKey);
    } catch {
      /* fall through */
    }
  }
  const entry = localIdempotency.get(redisKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localIdempotency.delete(redisKey);
    return null;
  }
  return entry.body;
}

async function idempotentSet(shop: string, key: string, body: string): Promise<void> {
  const redisKey = `push:idem:${shop}:${key}`;
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(redisKey, body, "EX", IDEM_TTL_SECONDS);
      return;
    } catch {
      /* fall through */
    }
  }
  if (localIdempotency.size > 500) localIdempotency.clear();
  localIdempotency.set(redisKey, {
    body,
    expiresAt: Date.now() + IDEM_TTL_SECONDS * 1000,
  });
}

/* ------------------------------------------------------------------ */
/* Send orchestration                                                  */
/* ------------------------------------------------------------------ */

export type SendOutcome =
  | { ok: true; id: string; status: "sent" }
  | {
      ok: false;
      id?: string;
      status: "invalid" | "rate_limited" | "failed";
      error: string;
      fields?: PushFieldErrors;
      /** True when a row exists (send attempted, upstream failed). */
      recorded?: boolean;
    };

function imagePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

async function shopOwnsImage(shop: string, imageUrl: string): Promise<boolean> {
  const exact = await db.media.findFirst({
    where: { shop, url: imageUrl },
    select: { id: true },
  });
  if (exact) return true;
  const path = imagePath(imageUrl);
  const sameFile = await db.media.findFirst({
    where: { shop, url: { startsWith: path } },
    select: { id: true },
  });
  return Boolean(sameFile);
}

function logSendAttempt(
  shop: string,
  id: string,
  status: string,
  extra?: Record<string, unknown>,
) {
  // Structured, secret-free log line for send attempts.
  console.log(JSON.stringify({ event: "push.send", shop, id, status, ...extra }));
}

/**
 * Validate → rate limit → create "pending" row → call the push API →
 * update the row to "sent"/"failed". Never throws for upstream failures.
 *
 * When `idempotencyKey` is provided, replaying the same key returns the
 * first recorded outcome instead of sending twice.
 */
export async function createAndSendPushNotification(
  shop: string,
  input: PushNotificationInput,
  options?: { idempotencyKey?: string },
): Promise<SendOutcome> {
  // 1. Server-side validation — the client copy is advisory only.
  const fields = validatePushInput({
    title: input.title,
    message: input.message,
    deeplink: input.deeplink || "",
    imageUrl: input.imageUrl,
    deviceToken: input.deviceToken,
  });
  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      status: "invalid",
      error: "Fix the highlighted fields and try again.",
      fields,
    };
  }

  const trimmed = {
    title: input.title.trim(),
    message: input.message.trim(),
    deeplink: (input.deeplink || "").trim(),
    imageUrl: (input.imageUrl || "").trim() || undefined,
    imageName: (input.imageName || "").trim() || undefined,
    imageSize: input.imageSize || undefined,
    deviceToken: (input.deviceToken || "").trim() || undefined,
  };

  // 2. Replay check before doing any work. Cap the key so it can't bloat Redis.
  const idemKey = options?.idempotencyKey?.trim().slice(0, 128);
  if (idemKey) {
    const cached = await idempotentGet(shop, idemKey);
    if (cached) return JSON.parse(cached) as SendOutcome;
  }

  // The image must be one this shop uploaded — never an arbitrary https URL.
  // Shopify adds or changes ?v= after upload, so match the file path, not the
  // full string saved at upload time.
  if (trimmed.imageUrl && !(await shopOwnsImage(shop, trimmed.imageUrl))) {
    return {
      ok: false,
      status: "invalid",
      error: "Upload the image again before sending.",
      fields: { imageUrl: "This image isn’t from an upload on this store." },
    };
  }

  // 3. Rate limit — before creating any rows.
  if (!(await underRateLimit(shop))) {
    return {
      ok: false,
      status: "rate_limited",
      error: "Too many sends this minute. Wait a moment and try again.",
    };
  }

  // 4. Record as pending so history survives a crash mid-send.
  const row = await db.pushNotification.create({
    data: {
      shop,
      title: trimmed.title,
      message: trimmed.message,
      imageUrl: trimmed.imageUrl || null,
      imageName: trimmed.imageName || null,
      imageSize: trimmed.imageSize || null,
      deeplink: trimmed.deeplink || null,
      status: "pending",
    },
  });

  // 5. Call FCM. Catch crashes so the row is "failed" instead of a 502.
  let result: Awaited<ReturnType<typeof sendPush>>;
  try {
    result = await sendPush({
      title: trimmed.title,
      message: trimmed.message,
      imageUrl: trimmed.imageUrl,
      deeplink: trimmed.deeplink,
      deviceToken: trimmed.deviceToken,
    });
  } catch (error) {
    result = {
      ok: false,
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Push send crashed.",
    };
  }

  if (result.ok) {
    await db.pushNotification.update({
      where: { id: row.id },
      data: { status: "sent", sentAt: new Date(), errorMessage: null },
    });
    logSendAttempt(shop, row.id, "sent", {
      providerId: result.providerId,
      testDevice: Boolean(trimmed.deviceToken),
    });
    const outcome: SendOutcome = { ok: true, id: row.id, status: "sent" };
    if (idemKey) await idempotentSet(shop, idemKey, JSON.stringify(outcome));
    return outcome;
  }

  const error = result.error || "Push API rejected the notification.";
  await db.pushNotification.update({
    where: { id: row.id },
    data: { status: "failed", errorMessage: error },
  });
  logSendAttempt(shop, row.id, "failed", { reason: error });
  const outcome: SendOutcome = {
    ok: false,
    id: row.id,
    status: "failed",
    error,
    recorded: true,
  };
  if (idemKey) await idempotentSet(shop, idemKey, JSON.stringify(outcome));
  return outcome;
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export type HistoryQuery = {
  page?: number;
  pageSize?: number;
  status?: string; // all | pending | sent | failed
  q?: string;
  sort?: "asc" | "desc";
};

export type HistoryCounts = { all: number; sent: number; failed: number };

export type HistoryResult = {
  items: PushNotification[];
  total: number;
  page: number;
  pages: number;
  counts: HistoryCounts;
};

export async function listPushNotifications(
  shop: string,
  options?: HistoryQuery,
): Promise<HistoryResult> {
  const page = Math.max(1, Math.floor(options?.page || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(options?.pageSize || 6)));
  const requested = options?.status || "all";
  const status =
    requested === "sent" || requested === "failed" || requested === "pending"
      ? requested
      : "all";
  const sort = options?.sort === "asc" ? "asc" : "desc";
  const q = (options?.q || "").trim();

  const where: {
    shop: string;
    status?: string;
    OR?: Array<
      | { title: { contains: string; mode: "insensitive" } }
      | { message: { contains: string; mode: "insensitive" } }
    >;
  } = { shop };
  if (status !== "all") where.status = status;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total, counts] = await Promise.all([
    db.pushNotification.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.pushNotification.count({ where }),
    getPushNotificationStats(shop),
  ]);

  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
  };
}

export async function getPushNotification(
  shop: string,
  id: string,
): Promise<PushNotification | null> {
  return db.pushNotification.findFirst({
    where: { id, shop },
  });
}

export async function deletePushNotification(
  shop: string,
  id: string,
): Promise<boolean> {
  const result = await db.pushNotification.deleteMany({
    where: { id, shop },
  });
  return result.count > 0;
}

export async function getPushNotificationStats(shop: string): Promise<HistoryCounts> {
  const [all, sent, failed] = await Promise.all([
    db.pushNotification.count({ where: { shop } }),
    db.pushNotification.count({ where: { shop, status: "sent" } }),
    db.pushNotification.count({ where: { shop, status: "failed" } }),
  ]);

  return { all, sent, failed };
}