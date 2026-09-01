import { getRedisClient } from "../redis-cache.server";
import { protectionConfig } from "./config.server";

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    public readonly dimension: string,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** In-process fallback counters when Redis is down (per server). */
const localCounters = new Map<string, { count: number; resetAt: number }>();

function localIncr(key: string, windowSeconds: number, limit: number): boolean {
  const now = Date.now();
  const entry = localCounters.get(key);
  if (!entry || entry.resetAt <= now) {
    localCounters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  if (entry.count > limit) return false;
  return true;
}

/**
 * Fixed-window counter. Returns true if under limit, false if exceeded.
 * Uses Redis INCR + EXPIRE when available; degrades to local counter.
 */
async function fixedWindowAllow(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  if (limit <= 0) return true;

  const redis = getRedisClient();
  if (!redis) {
    return localIncr(key, windowSeconds, limit);
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch (err) {
    console.error("[rate-limit] Redis error, using local fallback:", err);
    return localIncr(key, windowSeconds, limit);
  }
}

function minuteBucket(): string {
  return Math.floor(Date.now() / 60_000).toString();
}

export type RateLimitContext = {
  clientIp?: string;
  cacheKey?: string;
};

/** Soft IP limit for all /graphql traffic (high ceiling — does not block cache HITs in practice). */
export async function checkGraphqlIpLimit(clientIp: string | undefined): Promise<void> {
  const ip = clientIp || "unknown";
  const key = `rl:graphql:ip:${ip}:${minuteBucket()}`;
  const allowed = await fixedWindowAllow(key, protectionConfig.rateLimit.ipPerMinute);
  if (!allowed) {
    throw new RateLimitError("Too many GraphQL requests from this IP.", 60, "ip");
  }
}

/**
 * Strict limits applied only before an outbound Shopify call (cache MISS / refresh / bypass).
 */
export async function checkShopifyOutboundLimits(ctx: RateLimitContext): Promise<void> {
  const bucket = minuteBucket();
  const ip = ctx.clientIp || "unknown";

  const checks: Array<{ key: string; limit: number; dimension: string }> = [
    {
      key: `rl:shopify:global:${bucket}`,
      limit: protectionConfig.rateLimit.shopifyGlobalPerMinute,
      dimension: "global",
    },
    {
      key: `rl:shopify:ip:${ip}:${bucket}`,
      limit: protectionConfig.rateLimit.shopifyMissPerIpMinute,
      dimension: "shopify_ip",
    },
  ];

  if (ctx.cacheKey) {
    checks.push({
      key: `rl:shopify:key:${ctx.cacheKey}:${bucket}`,
      limit: protectionConfig.rateLimit.cacheKeyPerMinute,
      dimension: "cache_key",
    });
  }

  for (const { key, limit, dimension } of checks) {
    const allowed = await fixedWindowAllow(key, limit);
    if (!allowed) {
      throw new RateLimitError("Shopify request rate limit exceeded.", 60, dimension);
    }
  }
}

/** Extra local-only cap when Redis is unavailable (per server). */
export async function checkLocalShopifyFallbackLimit(): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.ping();
      return;
    } catch {
      /* fall through to local limit */
    }
  }

  const key = `local:shopify:${minuteBucket()}`;
  const allowed = localIncr(
    key,
    60,
    protectionConfig.rateLimit.localShopifyPerMinute,
  );
  if (!allowed) {
    throw new RateLimitError(
      "Shopify protection active — Redis unavailable, try again shortly.",
      30,
      "local_fallback",
    );
  }
}
