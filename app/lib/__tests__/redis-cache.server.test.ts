import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCacheKey, canonicalGraphqlGetPath, canonicalGraphqlRedirectPath } from "../redis-cache.server";

// ---------------------------------------------------------------------------
// We test the pure functions directly and mock the Redis-dependent ones.
// ---------------------------------------------------------------------------

describe("buildCacheKey", () => {
  it("produces a deterministic key for the same inputs", () => {
    const key1 = buildCacheKey("shop.myshopify.com", "query { foo }", { id: "123" });
    const key2 = buildCacheKey("shop.myshopify.com", "query { foo }", { id: "123" });
    expect(key1).toBe(key2);
  });

  it("prefixes with shopify:graphql:", () => {
    const key = buildCacheKey("shop.myshopify.com", "query { foo }");
    expect(key).toMatch(/^shopify:graphql:shop\.myshopify\.com:/);
  });

  it("produces different keys for different shops", () => {
    const key1 = buildCacheKey("shop-a.myshopify.com", "query { foo }");
    const key2 = buildCacheKey("shop-b.myshopify.com", "query { foo }");
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different queries", () => {
    const key1 = buildCacheKey("shop.myshopify.com", "query { foo }");
    const key2 = buildCacheKey("shop.myshopify.com", "query { bar }");
    expect(key1).not.toBe(key2);
  });

  it("treats after:null the same as omitting after", () => {
    const key1 = buildCacheKey("shop.myshopify.com", "query { foo }", {
      id: "gid://shopify/Collection/1",
      first: 10,
      after: null,
    });
    const key2 = buildCacheKey("shop.myshopify.com", "query { foo }", {
      id: "gid://shopify/Collection/1",
      first: 10,
    });
    expect(key1).toBe(key2);
  });

  it("normalizes variable key order — same key regardless of property order", () => {
    const key1 = buildCacheKey("shop.myshopify.com", "query { foo }", {
      id: "123",
      first: 250,
    });
    const key2 = buildCacheKey("shop.myshopify.com", "query { foo }", {
      first: 250,
      id: "123",
    });
    expect(key1).toBe(key2);
  });

  it("normalizes nested variable key order", () => {
    const key1 = buildCacheKey("shop.myshopify.com", "query { foo }", {
      filter: { b: 2, a: 1 },
      id: "123",
    });
    const key2 = buildCacheKey("shop.myshopify.com", "query { foo }", {
      id: "123",
      filter: { a: 1, b: 2 },
    });
    expect(key1).toBe(key2);
  });

  it("handles undefined variables", () => {
    const key = buildCacheKey("shop.myshopify.com", "query { foo }");
    expect(key).toMatch(/^shopify:graphql:shop\.myshopify\.com:/);
  });

  it("hashes the query (truncated to 16 hex chars)", () => {
    const key = buildCacheKey("shop.myshopify.com", "query { foo }");
    const hashPart = key.split(":").pop()!;
    expect(hashPart).toHaveLength(16);
    expect(hashPart).toMatch(/^[a-f0-9]+$/);
  });
});

describe("canonicalGraphqlRedirectPath", () => {
  it("redirects after:null to the canonical variables URL", () => {
    const url = new URL(
      "https://appbuilder.dreamzapps.com/graphql?sha256=759dff3d67482d144ca62a01301eb3e214641c3ed0cf99b0e871495ce4db6611&variables=%7B%22id%22%3A%22gid%3A%2F%2Fshopify%2FCollection%2F375678697663%22%2C%22first%22%3A10%2C%22after%22%3Anull%7D",
    );
    const redirect = canonicalGraphqlRedirectPath(url);
    expect(redirect).toBe(
      canonicalGraphqlGetPath(
        "759dff3d67482d144ca62a01301eb3e214641c3ed0cf99b0e871495ce4db6611",
        { id: "gid://shopify/Collection/375678697663", first: 10 },
      ),
    );
  });

  it("does not redirect an already canonical URL", () => {
    const path = canonicalGraphqlGetPath("abc", { first: 10, id: "1" });
    const url = new URL(`https://appbuilder.dreamzapps.com${path}`);
    expect(canonicalGraphqlRedirectPath(url)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mocked tests for cacheGet / cacheSet / withCache
// ---------------------------------------------------------------------------

// Mock ioredis
vi.mock("ioredis", () => {
  const store = new Map<string, string>();
  let shouldFail = false;

  return {
    Redis: class MockRedis {
      static __store = store;
      static __setShouldFail(v: boolean) {
        shouldFail = v;
      }
      static __clear() {
        store.clear();
      }

      // ioredis constructor takes (url, options); event listeners are no-ops.
      constructor(_url?: string, _opts?: unknown) {}
      on() {
        return this;
      }

      ping() {
        if (shouldFail) return Promise.reject(new Error("ECONNREFUSED"));
        return Promise.resolve("PONG");
      }
      get(key: string) {
        if (shouldFail) return Promise.reject(new Error("ECONNREFUSED"));
        return Promise.resolve(store.get(key) ?? null);
      }
      // ioredis signature: set(key, value, "EX", ttlSeconds)
      set(key: string, value: string, ..._args: unknown[]) {
        if (shouldFail) return Promise.reject(new Error("ECONNREFUSED"));
        store.set(key, value);
        return Promise.resolve("OK");
      }
      del(key: string) {
        store.delete(key);
        return Promise.resolve(1);
      }
    },
  };
});

describe("cacheGet / cacheSet (via withCache)", () => {
  let withCache: typeof import("../redis-cache.server").withCache;
  let isRedisAvailable: typeof import("../redis-cache.server").isRedisAvailable;
  let MockRedis: typeof import("ioredis").Redis;

  beforeEach(async () => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.SHOPIFY_GRAPHQL_CACHE_TTL = "60";

    const mod = await import("../redis-cache.server");
    withCache = mod.withCache;
    isRedisAvailable = mod.isRedisAvailable;

    MockRedis = (await import("ioredis")).Redis;
    type MockStatics = { __clear: () => void; __setShouldFail: (v: boolean) => void };
    const MockCtor = MockRedis as unknown as MockStatics;
    MockCtor.__clear();
    MockCtor.__setShouldFail(false);
  });

  it("returns MISS on first call (empty cache)", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "from-shopify" });
    const result = await withCache("test:key", "default", fetcher);

    expect(result.cacheStatus).toBe("MISS");
    expect(result.data).toEqual({ data: "from-shopify" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("returns HIT on second call (cache populated)", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "from-shopify" });

    // First call — MISS
    const result1 = await withCache("test:key", "default", fetcher);
    expect(result1.cacheStatus).toBe("MISS");

    // Second call — should be HIT, fetcher NOT called again
    const result2 = await withCache("test:key", "default", fetcher);
    expect(result2.cacheStatus).toBe("HIT");
    expect(result2.data).toEqual({ data: "from-shopify" });
    expect(fetcher).toHaveBeenCalledOnce(); // still only once
  });

  it("bypass mode skips cache read and fetches fresh", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });

    // Pre-populate cache
    await withCache("test:bypass", "default", fetcher);
    fetcher.mockClear();

    // Bypass should ignore cache
    const result = await withCache("test:bypass", "bypass", fetcher);
    expect(result.cacheStatus).toBe("BYPASS");
    expect(result.data).toEqual({ data: "fresh" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("refresh mode overwrites cache", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ data: "old" })
      .mockResolvedValueOnce({ data: "new" });

    // Populate cache
    await withCache("test:refresh", "default", fetcher);

    // Refresh with new data
    const result = await withCache("test:refresh", "refresh", fetcher);
    expect(result.cacheStatus).toBe("REFRESH");
    expect(result.data).toEqual({ data: "new" });

    // Next default call should return the refreshed value
    const cached = await withCache("test:refresh", "default", fetcher);
    expect(cached.cacheStatus).toBe("HIT");
    expect(cached.data).toEqual({ data: "new" });
  });

  it("degrades gracefully when Redis is unavailable", async () => {
    type MockStatics = { __setShouldFail: (v: boolean) => void };
    (MockRedis as unknown as MockStatics).__setShouldFail(true);

    const fetcher = vi.fn().mockResolvedValue({ data: "fallback" });
    const result = await withCache("test:fail", "default", fetcher);

    expect(result.cacheStatus).toBe("MISS");
    expect(result.data).toEqual({ data: "fallback" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("isRedisAvailable returns false when Redis is down", async () => {
    type MockStatics = { __setShouldFail: (v: boolean) => void };
    (MockRedis as unknown as MockStatics).__setShouldFail(true);
    const available = await isRedisAvailable();
    expect(available).toBe(false);
  });

  it("isRedisAvailable returns true when Redis is up", async () => {
    type MockStatics = { __setShouldFail: (v: boolean) => void };
    (MockRedis as unknown as MockStatics).__setShouldFail(false);
    const available = await isRedisAvailable();
    expect(available).toBe(true);
  });

  it("stale-while-revalidate: serves stale instantly and refreshes in background", async () => {
    // ttl=1s, swr=10s → fresh <1s, stale 1s–11s, dead >11s.
    process.env.SHOPIFY_GRAPHQL_CACHE_TTL = "1";
    process.env.SHOPIFY_GRAPHQL_CACHE_SWR = "10";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({ data: "v1" })
        .mockResolvedValueOnce({ data: "v2" });

      const first = await withCache("swr:key", "default", fetcher, { ttlSeconds: 1 });
      expect(first.cacheStatus).toBe("MISS");
      expect(first.data).toEqual({ data: "v1" });
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Move into the stale window (past exp=1s, before staleUntil).
      vi.setSystemTime(new Date(2000));

      const second = await withCache("swr:key", "default", fetcher, { ttlSeconds: 1 });
      expect(second.cacheStatus).toBe("STALE"); // served immediately
      expect(second.data).toEqual({ data: "v1" }); // still the old value
      expect(fetcher).toHaveBeenCalledTimes(2); // background refresh kicked off

      // Let the background refresh settle; a fresh read now returns the new value.
      await Promise.resolve();
      await Promise.resolve();
      const third = await withCache("swr:key", "default", fetcher, { ttlSeconds: 1 });
      expect(third.cacheStatus).toBe("HIT");
      expect(third.data).toEqual({ data: "v2" });
      expect(fetcher).toHaveBeenCalledTimes(2); // no extra fetch on the fresh hit
    } finally {
      vi.useRealTimers();
      delete process.env.SHOPIFY_GRAPHQL_CACHE_SWR;
      process.env.SHOPIFY_GRAPHQL_CACHE_TTL = "60";
    }
  });

  it("persisted queries: register a query then resolve it by sha256 hash", async () => {
    const mod = await import("../redis-cache.server");
    const query = "query { shop { name } }";

    const hash = await mod.setPersistedQuery(query);
    expect(hash).toBe(mod.sha256Hex(query));
    expect(hash).toHaveLength(64);

    expect(await mod.getPersistedQuery(hash)).toBe(query);
    expect(await mod.getPersistedQuery("0".repeat(64))).toBeNull();
  });
});
