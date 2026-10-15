import { Redis } from "ioredis";
import { createHash } from "crypto";

import {
  tryAcquireCacheLock,
  releaseCacheLock,
  waitForCacheFill,
} from "./protection/distributed-lock.server";
import {
  DEFAULT_CACHE_TTL_SECONDS,
  envCacheSwr,
  envCacheTtl,
  getRuntimeCachePolicy,
  hasRuntimeCachePolicy,
  MAX_CACHE_TTL_SECONDS,
  MIN_CACHE_TTL_SECONDS,
} from "./cache-policy.server";
import {
  CircuitOpenError,
  RateLimitError,
} from "./protection/storefront-fetch.server";

// ---------------------------------------------------------------------------
// Redis singleton (lazy — degrades gracefully when REDIS_URL is unset)
//
// Uses ioredis over a single, persistent TCP connection that is opened once and
// reused for every command. Unlike a REST client there is no per-command HTTP
// handshake, so a co-located Redis (e.g. redis://localhost:6379) answers in
// well under a millisecond. Every cache op is wrapped in try/catch and falls
// back to the in-process L1 cache below, so a slow or unreachable Redis never
// blocks or breaks a response.
// ---------------------------------------------------------------------------

let client: Redis | null = null;

/** Shared Redis client for cache, locks, and rate limiting (lazy singleton). */
export function getRedisClient(): Redis | null {
  return getClient();
}

function getClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[redis-cache] Redis disabled — missing REDIS_URL");
    return null;
  }

  if (!client) {
    let tls: { servername: string } | undefined;
    try {
      const parsed = new URL(url);
      // Layerbase / rediss:// often connects by IP; without SNI the handshake
      // closes immediately ("Connection is closed").
      if (parsed.protocol === "rediss:" && parsed.hostname) {
        tls = { servername: parsed.hostname };
      }
    } catch {
      tls = undefined;
    }
    client = new Redis(url, {
      // Fail fast: a slow or down Redis must never hold up the request path —
      // callers degrade to the L1 memory cache on any error.
      maxRetriesPerRequest: 2,
      connectTimeout: tls ? 8000 : 3000,
      // Reconnect in the background, backing off from 200ms up to 2s.
      retryStrategy: (times) => Math.min(times * 200, 2000),
      ...(tls ? { tls } : {}),
    });
    // Without an 'error' listener ioredis throws on connection loss. Swallow
    // and log — the app must keep serving from L1 while Redis is unreachable.
    client.on("error", (err: unknown) => {
      console.error(
        "[redis-cache] connection error:",
        err instanceof Error ? err.message : err,
      );
    });
    console.log("[redis-cache] Redis client created (ioredis, TCP keep-alive)");
  }

  return client;
}

// ---------------------------------------------------------------------------
// Cache envelope (enables stale-while-revalidate + a correct L1 promotion TTL)
//
// Every cached value is wrapped so that its freshness is carried WITH the value
// rather than being inferred from a separate TTL:
//
//   fresh   now <  exp          → serve as HIT
//   stale   exp <= now < staleUntil → serve immediately as STALE, refresh in bg
//   dead    now >= staleUntil    → treat as a miss
//
// Because `exp`/`staleUntil` travel inside the value, promoting a Redis hit
// into L1 uses the entry's *remaining* lifetime — never a fresh full TTL (the
// old bug) — and we never need a separate `redis.ttl()` round-trip.
// ---------------------------------------------------------------------------

type Envelope<T = unknown> = {
  __swr: 1;
  v: T;
  exp: number; // epoch ms after which the value is stale
  staleUntil: number; // epoch ms after which the value is dead
};

function isEnvelope(value: unknown): value is Envelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Envelope).__swr === 1 &&
    typeof (value as Envelope).exp === "number" &&
    typeof (value as Envelope).staleUntil === "number"
  );
}

/** Build a fresh envelope for `value` using the configured TTL + SWR window. */
function makeEnvelope<T>(value: T, ttlSeconds?: number): Envelope<T> {
  const now = Date.now();
  const ttlMs = (ttlSeconds ?? getCacheTTL()) * 1000;
  const swrMs = getCacheSWR() * 1000;
  return { __swr: 1, v: value, exp: now + ttlMs, staleUntil: now + ttlMs + swrMs };
}

/**
 * Coerce a parsed cache value into an envelope. Values written before this
 * change are bare (no `__swr` marker) — treat them as fresh so an in-flight
 * deploy never invalidates the whole cache at once.
 */
function toEnvelope<T>(parsed: unknown): Envelope<T> {
  if (isEnvelope(parsed)) return parsed as Envelope<T>;
  const now = Date.now();
  const ttlMs = getCacheTTL() * 1000;
  const swrMs = getCacheSWR() * 1000;
  return { __swr: 1, v: parsed as T, exp: now + ttlMs, staleUntil: now + ttlMs + swrMs };
}

// ---------------------------------------------------------------------------
// In-process L1 cache
//
// The app runs as a single Node process (react-router-serve), so a per-process
// cache is safe and serves repeat queries from RAM (~0ms) without ever touching
// Redis. Redis remains the shared/persistent L2 layer behind it. L1 stores the
// envelope directly and evicts only once a value is fully dead (past
// staleUntil), so it too can serve the stale window.
// ---------------------------------------------------------------------------

const memory = new Map<string, Envelope>();
const MEMORY_MAX_ENTRIES = 1000;

function memGet(key: string): Envelope | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.staleUntil <= Date.now()) {
    memory.delete(key);
    return null;
  }
  // Bump recency (Map preserves insertion order → cheap LRU).
  memory.delete(key);
  memory.set(key, entry);
  return entry;
}

function memSet(key: string, env: Envelope): void {
  if (memory.size >= MEMORY_MAX_ENTRIES && !memory.has(key)) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, env);
}

function memDel(key: string): void {
  memory.delete(key);
}

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a variables object so that key order does not affect the hash.
 * Recursively sorts keys at every level.
 */
function normalizeVariables(variables: Record<string, unknown>): Record<string, unknown> {
  if (!variables || typeof variables !== "object") return {};
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(variables).sort()) {
    const val = variables[key];
    // `after: null` (page 1) must match omitting `after` — same PLP, same cache.
    if (val === null || val === undefined) continue;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = normalizeVariables(val as Record<string, unknown>);
      if (Object.keys(nested).length > 0) sorted[key] = nested;
    } else {
      sorted[key] = val;
    }
  }
  return sorted;
}

export function canonicalizeGraphqlVariables(
  variables?: Record<string, unknown>,
): Record<string, unknown> {
  return normalizeVariables(variables ?? {});
}

/** Stable GET query for CDN: drop nulls, sort keys, one encoding. */
export function canonicalGraphqlGetPath(
  sha256: string,
  variables?: Record<string, unknown>,
): string {
  const vars = JSON.stringify(canonicalizeGraphqlVariables(variables));
  return `/graphql?sha256=${sha256.trim().toLowerCase()}&variables=${encodeURIComponent(vars)}`;
}

export function canonicalGraphqlRedirectPath(url: URL): string | null {
  const sha256 = url.searchParams.get("sha256")?.trim() ?? "";
  if (!sha256 || url.searchParams.has("query")) return null;
  const raw = url.searchParams.get("variables");
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const canonical = canonicalGraphqlGetPath(sha256, parsed);
  const incoming = `/graphql?sha256=${sha256}&variables=${encodeURIComponent(raw || "{}")}`;
  const extra = [...url.searchParams.keys()].filter((key) => key !== "sha256" && key !== "variables");
  if (extra.length === 0 && incoming === canonical) return null;
  return canonical;
}

/**
 * Build a deterministic cache key for a GraphQL request.
 *
 * Format: `shopify:graphql:{shop}:{sha256(query + normalizedVariables)}`
 */
export function buildCacheKey(
  shop: string,
  query: string,
  variables?: Record<string, unknown>,
): string {
  const normalised = normalizeVariables(variables ?? {});
  const payload = query.trim() + JSON.stringify(normalised);
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return `shopify:graphql:${shop}:${hash}`;
}

// ---------------------------------------------------------------------------
// TTL
// ---------------------------------------------------------------------------

function clampCacheWindow(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < MIN_CACHE_TTL_SECONDS) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }
  return Math.min(Math.floor(seconds), MAX_CACHE_TTL_SECONDS);
}

/**
 * Cache lifetime in seconds. Redis and CDN share this 10–30 minute window.
 */
export function getCacheTTL(): number {
  if (hasRuntimeCachePolicy()) {
    return clampCacheWindow(getRuntimeCachePolicy().ttlSeconds);
  }
  const envTtl = envCacheTtl();
  if (envTtl !== null) return clampCacheWindow(envTtl);
  return DEFAULT_CACHE_TTL_SECONDS;
}

/**
 * Stale-while-revalidate window in seconds — how long past `max-age` a value
 * may still be served (instantly) while a fresh copy is fetched in the
 * background. Defaults to the TTL, so the total lifetime is 2×TTL (matching the
 * `stale-while-revalidate=<ttl*2>` posture in the response headers).
 * Configure via `SHOPIFY_GRAPHQL_CACHE_SWR` (seconds).
 */
export function getCacheSWR(): number {
  if (hasRuntimeCachePolicy()) {
    return clampCacheWindow(getRuntimeCachePolicy().swrSeconds);
  }
  const envSwr = envCacheSwr();
  if (envSwr !== null) return clampCacheWindow(envSwr);
  return getCacheTTL();
}

// ---------------------------------------------------------------------------
// Low-level Redis I/O (L2)
// ---------------------------------------------------------------------------

/** Write a value to Redis. Never throws — logs and swallows errors. */
async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!getRuntimeCachePolicy().redisEnabled) return;
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("[redis-cache] SET error:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CacheMode = "default" | "bypass" | "refresh";

export type CacheStatus = "HIT" | "MISS" | "BYPASS" | "REFRESH" | "STALE";

export type CacheTimings = {
  l1Ms: number;
  l2Ms: number;
  fetchMs: number;
  totalMs: number;
};

export type CacheResult<T> = {
  data: T | null;
  hit: boolean;
  /** True when the value is past `exp` but still within the SWR window. */
  stale: boolean;
  /** Which layer served the value (used for timing attribution). */
  source?: "l1" | "l2";
};

/**
 * Read from cache: L1 (memory) first, then L2 (Redis). A Redis hit populates
 * L1 (with the entry's own remaining lifetime) so subsequent reads skip the
 * network entirely. Returns `{ data: null, hit: false, stale: false }` on miss.
 */
export async function cacheGet<T>(key: string): Promise<CacheResult<T>> {
  const now = Date.now();

  // --- L1: in-process memory ---
  const memEnv = memGet(key);
  if (memEnv) {
    return { data: memEnv.v as T, hit: true, stale: now >= memEnv.exp, source: "l1" };
  }

  // --- L2: Redis ---
  if (!getRuntimeCachePolicy().redisEnabled) {
    return { data: null, hit: false, stale: false };
  }
  const redis = getClient();
  if (!redis) {
    return { data: null, hit: false, stale: false };
  }

  try {
    const raw = await redis.get(key);
    if (raw === null) {
      return { data: null, hit: false, stale: false };
    }
    const env = toEnvelope<T>(JSON.parse(raw));
    if (now >= env.staleUntil) {
      // Fully dead (Redis kept it a touch too long) — treat as a miss.
      return { data: null, hit: false, stale: false };
    }
    memSet(key, env); // promote into L1 with its OWN remaining lifetime
    return { data: env.v, hit: true, stale: now >= env.exp, source: "l2" };
  } catch (err) {
    console.error("[redis-cache] GET error:", err instanceof Error ? err.message : err);
    return { data: null, hit: false, stale: false };
  }
}

/**
 * Write to both cache layers with the configured TTL + SWR window. Awaits the
 * Redis write.
 */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  const env = makeEnvelope(value);
  memSet(key, env);
  await redisSet(key, env, getCacheTTL() + getCacheSWR());
}

/**
 * Delete a key from both cache layers.
 */
export async function cacheDel(key: string): Promise<void> {
  memDel(key);
  const redis = getClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (err) {
    console.error("[redis-cache] DEL error:", err instanceof Error ? err.message : err);
  }
}

/** Delete all keys with the given prefix from L1 and Redis (SCAN, non-blocking). */
export async function cacheDelByPrefix(prefix: string): Promise<number> {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }

  const redis = getClient();
  if (!redis) return 0;

  let deleted = 0;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error("[redis-cache] SCAN/DEL error:", err instanceof Error ? err.message : err);
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Persisted queries (enables a short, cacheable GET URL: `?sha256=<hash>`)
//
// A GraphQL query string is hashed to a stable sha256; the hash→query mapping
// lives in Redis (shared across instances) with a small in-process LRU in
// front. This lets a client send a short `GET /graphql?sha256=<hash>` — which
// Cloudflare can cache by URL at the edge — instead of a long, uncacheable
// POST. Registration is automatic: whenever a full query flows through the
// gateway we record its hash.
// ---------------------------------------------------------------------------

const PQ_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PQ_MEM_MAX = 500;
const pqMemory = new Map<string, string>(); // hash -> query

/** sha256 hex digest of a string (full 64-char digest — APQ compatible). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function writePersistedQuery(hash: string, query: string): Promise<void> {
  if (pqMemory.size >= PQ_MEM_MAX && !pqMemory.has(hash)) {
    const oldest = pqMemory.keys().next().value;
    if (oldest !== undefined) pqMemory.delete(oldest);
  }
  pqMemory.set(hash, query);
  const redis = getClient();
  if (redis) {
    try {
      await redis.set(`pq:${hash}`, query, "EX", PQ_TTL_SECONDS);
    } catch (err) {
      console.error("[redis-cache] PQ SET error:", err instanceof Error ? err.message : err);
    }
  }
}

/** Register a query so it can later be resolved by its sha256 hash. */
export async function setPersistedQuery(query: string, aliasHash?: string): Promise<string> {
  const hash = sha256Hex(query);
  await writePersistedQuery(hash, query);
  if (aliasHash && aliasHash !== hash) await writePersistedQuery(aliasHash, query);
  return hash;
}

/** Resolve a query string from its sha256 hash, or null if unknown. */
export async function getPersistedQuery(hash: string): Promise<string | null> {
  const mem = pqMemory.get(hash);
  if (mem !== undefined) return mem;

  const redis = getClient();
  if (!redis) return null;
  try {
    const query = await redis.get(`pq:${hash}`);
    if (query !== null) pqMemory.set(hash, query);
    return query;
  } catch (err) {
    console.error("[redis-cache] PQ GET error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-process single-flight (stampede prevention, 0 extra round-trips)
//
// Replaces the previous Redis-based lock (which added a SET-NX + DEL round-trip
// to every miss, plus up to 3s of polling on contention). Because the app is a
// single process, deduping concurrent identical misses in memory is both
// cheaper and more effective. The same map dedupes background SWR refreshes so
// only one refresh per key runs at a time.
// ---------------------------------------------------------------------------

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Execute a cached operation.
 *
 * - `default`: L1 → L2 → { fresh: HIT | stale: STALE + bg refresh | miss: fetch }
 * - `bypass`:  skip read → fetch → write both (async)
 * - `refresh`: skip read → fetch → overwrite both (awaited)
 *
 * On a STALE hit the cached value is returned immediately and a single
 * background refresh is kicked off (deduped via `inFlight`), so users never pay
 * the full miss cost at the expiry cliff.
 *
 * `options.shouldCache` gates whether a fetched value is stored — use it to
 * avoid caching error responses. Defaults to caching everything.
 *
 * Cache *writes* on the default/bypass paths are fire-and-forget: the caller
 * gets its data as soon as the fetcher resolves, without waiting on a Redis
 * round-trip. The returned `timings` break the work down per layer for
 * `Server-Timing`.
 */
export type WithCacheOptions<T> = {
  shouldCache?: (data: T) => boolean;
  distributed?: boolean;
  /** Redis (+ envelope) lifetime; defaults to the global 10–30 minute policy. */
  ttlSeconds?: number;
};

export async function withCache<T>(
  key: string,
  mode: CacheMode,
  fetcher: () => Promise<T>,
  options?: WithCacheOptions<T>,
): Promise<{ data: T; cacheStatus: CacheStatus; timings: CacheTimings }> {
  const shouldCache = options?.shouldCache ?? (() => true);
  const useDistributed = options?.distributed ?? false;
  const ttlSeconds = options?.ttlSeconds ?? getCacheTTL();
  const t0 = Date.now();
  const timings: CacheTimings = { l1Ms: 0, l2Ms: 0, fetchMs: 0, totalMs: 0 };

  const writeBoth = (data: T) => {
    if (!shouldCache(data)) return;
    const env = makeEnvelope(data, ttlSeconds);
    memSet(key, env);
    void redisSet(key, env, ttlSeconds + getCacheSWR());
  };

  // --- BYPASS: skip cache read, always fetch, write in background ---
  if (mode === "bypass") {
    const fs = Date.now();
    const data = await fetcher();
    timings.fetchMs = Date.now() - fs;
    writeBoth(data);
    timings.totalMs = Date.now() - t0;
    return { data, cacheStatus: "BYPASS", timings };
  }

  // --- REFRESH: skip cache read, always fetch, overwrite (awaited) ---
  if (mode === "refresh") {
    const fs = Date.now();
    const data = await fetcher();
    timings.fetchMs = Date.now() - fs;
    if (shouldCache(data)) {
      const env = makeEnvelope(data, ttlSeconds);
      memSet(key, env);
      await redisSet(key, env, ttlSeconds + getCacheSWR());
    }
    timings.totalMs = Date.now() - t0;
    return { data, cacheStatus: "REFRESH", timings };
  }

  // --- DEFAULT: check cache first ---
  const readStart = Date.now();
  const cached = await cacheGet<T>(key);
  const readMs = Date.now() - readStart;
  if (cached.source === "l1") timings.l1Ms = readMs;
  else timings.l2Ms = readMs; // L2 hit, or a miss (the Redis GET that missed)

  // Fresh hit.
  if (cached.hit && cached.data !== null && !cached.stale) {
    timings.totalMs = Date.now() - t0;
    return { data: cached.data, cacheStatus: "HIT", timings };
  }

  // Stale hit — serve immediately, refresh in the background (single-flight).
  if (cached.hit && cached.data !== null && cached.stale) {
    if (!inFlight.has(key)) {
      const refresh = (async () => {
        const data = await fetcher();
        writeBoth(data);
        return data;
      })();
      inFlight.set(key, refresh);
      refresh
        .catch((err) =>
          console.error(
            "[redis-cache] background refresh error:",
            err instanceof Error ? err.message : err,
          ),
        )
        .finally(() => inFlight.delete(key));
    }
    timings.totalMs = Date.now() - t0;
    return { data: cached.data, cacheStatus: "STALE", timings };
  }

  // Miss — single-flight (local) + optional distributed coalescing (Redis lock).
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) {
    const data = await existing;
    timings.totalMs = Date.now() - t0;
    return { data, cacheStatus: "MISS", timings };
  }

  const fs = Date.now();
  const promise = fetchWithCoalescing(key, fetcher, writeBoth, useDistributed);
  inFlight.set(key, promise);
  try {
    const data = await promise;
    timings.fetchMs = Date.now() - fs;
    timings.totalMs = Date.now() - t0;
    return { data, cacheStatus: "MISS", timings };
  } catch (err) {
    if (err instanceof RateLimitError || err instanceof CircuitOpenError) {
      throw err;
    }
    throw err;
  } finally {
    inFlight.delete(key);
  }
}

async function fetchWithCoalescing<T>(
  key: string,
  fetcher: () => Promise<T>,
  writeBoth: (data: T) => void,
  distributed: boolean,
): Promise<T> {
  if (!distributed || !getRedisClient()) {
    const data = await fetcher();
    writeBoth(data);
    return data;
  }

  const lock = await tryAcquireCacheLock(key);
  if (lock === null) {
    const data = await fetcher();
    writeBoth(data);
    return data;
  }

  if (lock.acquired) {
    try {
      const data = await fetcher();
      writeBoth(data);
      return data;
    } finally {
      await releaseCacheLock(lock.key, lock.token);
    }
  }

  // Another instance holds the lock — wait for cache fill.
  const waited = await waitForCacheFill<T>(async () => {
    const cached = await cacheGet<T>(key);
    return {
      hit: cached.hit,
      data: cached.data,
      stale: cached.stale,
    };
  });

  if (waited?.hit && waited.data !== null) {
    return waited.data;
  }

  // Timed out waiting — one controlled fetch (rate limits apply in fetcher).
  const data = await fetcher();
  writeBoth(data);
  return data;
}

/**
 * Check whether Redis is available (for health checks).
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
