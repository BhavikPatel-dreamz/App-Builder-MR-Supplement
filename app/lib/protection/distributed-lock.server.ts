import { randomUUID } from "crypto";

import { getRedisClient } from "../redis-cache.server";
import { protectionConfig } from "./config.server";

const LOCK_PREFIX = "lock:cache:";

/** Safe lock release — only delete if token matches. */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export type DistributedLockResult =
  | { acquired: true; token: string; key: string }
  | { acquired: false };

/**
 * Try to acquire a distributed cache-fetch lock (SET key token NX EX).
 * Returns null token when Redis is unavailable — caller uses local coalescing only.
 */
export async function tryAcquireCacheLock(
  cacheKey: string,
  ttlSeconds = protectionConfig.lock.ttlSeconds,
): Promise<DistributedLockResult | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const lockKey = `${LOCK_PREFIX}${cacheKey}`;
  const token = randomUUID();

  try {
    const result = await redis.set(lockKey, token, "EX", ttlSeconds, "NX");
    if (result === "OK") {
      return { acquired: true, token, key: lockKey };
    }
    return { acquired: false };
  } catch (err) {
    console.error(
      "[distributed-lock] acquire error:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function releaseCacheLock(lockKey: string, token: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.eval(RELEASE_SCRIPT, 1, lockKey, token);
  } catch (err) {
    console.error(
      "[distributed-lock] release error:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Poll until cache key appears, lock wait timeout, or abort. */
export async function waitForCacheFill<T>(
  read: () => Promise<{ hit: boolean; data: T | null; stale: boolean }>,
  waitMs = protectionConfig.lock.waitMs,
  pollMs = protectionConfig.lock.pollMs,
): Promise<{ hit: boolean; data: T | null; stale: boolean } | null> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const result = await read();
    if (result.hit && result.data !== null) return result;
    await sleep(pollMs);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
