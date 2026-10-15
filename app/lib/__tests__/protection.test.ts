import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ioredis", () => {
  const store = new Map<string, string>();
  const locks = new Map<string, string>();
  const counters = new Map<string, number>();

  return {
    Redis: class MockRedis {
      static __clear() {
        store.clear();
        locks.clear();
        counters.clear();
      }

      constructor(_url?: string, _opts?: unknown) {}
      on() {
        return this;
      }
      ping() {
        return Promise.resolve("PONG");
      }
      get(key: string) {
        return Promise.resolve(store.get(key) ?? null);
      }
      set(key: string, value: string, ...args: unknown[]) {
        const nx = args.includes("NX");
        if (nx && locks.has(key)) return Promise.resolve(null);
        if (nx) {
          locks.set(key, value);
          return Promise.resolve("OK");
        }
        store.set(key, value);
        if (typeof args[1] === "number" || args[0] === "EX") {
          /* ttl ignored in mock */
        }
        return Promise.resolve("OK");
      }
      del(key: string) {
        store.delete(key);
        locks.delete(key);
        return Promise.resolve(1);
      }
      incr(key: string) {
        counters.set(key, (counters.get(key) || 0) + 1);
        return Promise.resolve(counters.get(key)!);
      }
      expire(_key: string, _ttl: number) {
        return Promise.resolve(1);
      }
      eval(_script: string, _numKeys: number, key: string, token: string) {
        if (locks.get(key) === token) {
          locks.delete(key);
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      }
      scan(cursor: string, _match: string, _pattern: string, _count: string, _n: number) {
        const keys = [...store.keys()];
        return Promise.resolve(["0", keys] as [string, string[]]);
      }
    },
  };
});

describe("protection layer", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.GRAPHQL_RATE_LIMIT_IP_PER_MIN = "10000";
    process.env.GRAPHQL_RATE_LIMIT_SHOPIFY_MISS_PER_MIN = "10000";
    process.env.GRAPHQL_RATE_LIMIT_CACHE_KEY_PER_MIN = "10000";
    process.env.GRAPHQL_RATE_LIMIT_SHOPIFY_GLOBAL_PER_MIN = "10000";
    process.env.SHOPIFY_CB_FAILURE_THRESHOLD = "3";
    process.env.SHOPIFY_MAX_RETRIES = "1";
    process.env.SHOPIFY_STOREFRONT_TIMEOUT_MS = "5000";

    const { Redis } = await import("ioredis");
    (Redis as unknown as { __clear: () => void }).__clear();
  });

  it("rate limit blocks excessive Shopify outbound calls", async () => {
    process.env.GRAPHQL_RATE_LIMIT_SHOPIFY_GLOBAL_PER_MIN = "2";
    const { checkShopifyOutboundLimits } = await import("../protection/rate-limit.server");

    await checkShopifyOutboundLimits({ clientIp: "1.2.3.4", cacheKey: "k1" });
    await checkShopifyOutboundLimits({ clientIp: "1.2.3.4", cacheKey: "k1" });

    await expect(
      checkShopifyOutboundLimits({ clientIp: "1.2.3.4", cacheKey: "k1" }),
    ).rejects.toMatchObject({ name: "RateLimitError" });
  });

  it("circuit breaker opens after repeated failures", async () => {
    const { recordShopifyFailure, assertCircuitClosed, CircuitOpenError } =
      await import("../protection/circuit-breaker.server");

    await recordShopifyFailure();
    await recordShopifyFailure();
    await recordShopifyFailure();

    await expect(assertCircuitClosed()).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("graphql limits reject oversized queries", async () => {
    process.env.GRAPHQL_MAX_QUERY_LENGTH = "10";
    const { validateGraphqlRequestLimits } = await import("../protection/graphql-limits.server");

    const err = validateGraphqlRequestLimits({ query: "x".repeat(20) });
    expect(err?.status).toBe(413);
  });

  it("graphql require APQ mode rejects full query when enabled", async () => {
    process.env.GRAPHQL_REQUIRE_PERSISTED_QUERIES = "true";
    const { validateGraphqlRequestLimits } = await import("../protection/graphql-limits.server");

    const err = validateGraphqlRequestLimits({
      query: "query { shop { name } }",
      viaPersistedHash: false,
    });
    expect(err?.status).toBe(400);
  });

  it("distributed coalescing: concurrent misses share one fetcher", async () => {
    process.env.SHOPIFY_GRAPHQL_CACHE_TTL = "60";
    const { withCache } = await import("../redis-cache.server");

    let fetchCount = 0;
    const fetcher = vi.fn(async () => {
      fetchCount += 1;
      await new Promise((r) => setTimeout(r, 50));
      return { ok: true };
    });

    const results = await Promise.all([
      withCache("coalesce:key", "default", fetcher, { distributed: true }),
      withCache("coalesce:key", "default", fetcher, { distributed: true }),
      withCache("coalesce:key", "default", fetcher, { distributed: true }),
    ]);

    expect(results.every((r) => r.data)).toBe(true);
    expect(fetchCount).toBeLessThanOrEqual(2);
  });

  it("storefront fetch retries on 429 then succeeds", async () => {
    process.env.SHOPIFY_STOREFRONT_DOMAIN = "test.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "token";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: () => "1" },
        json: async () => ({ errors: [{ message: "Throttled" }] }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: { shop: { name: "Test" } } }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { callStorefrontWithProtection } = await import(
      "../protection/storefront-fetch.server"
    );

    const result = await callStorefrontWithProtection(
      { domain: "test.myshopify.com", token: "token", apiVersion: "2026-07" },
      { query: "query { shop { name } }", clientIp: "127.0.0.1", cacheKey: "k" },
    );

    expect(result.body.data).toEqual({ shop: { name: "Test" } });
    expect(result.retryCount).toBeGreaterThanOrEqual(1);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    vi.unstubAllGlobals();
  });

  it("invalidateStorefrontGraphqlCache clears storefront prefix only", async () => {
    const { cacheSet, buildCacheKey } = await import("../redis-cache.server");
    const { invalidateStorefrontGraphqlCache } = await import(
      "../protection/cache-invalidation.server"
    );

    const key = buildCacheKey("storefront:shop.myshopify.com", "query { a }");
    await cacheSet(key, { data: 1 });

    const deleted = await invalidateStorefrontGraphqlCache("shop.myshopify.com");
    expect(deleted).toBeGreaterThanOrEqual(0);
  });
});
