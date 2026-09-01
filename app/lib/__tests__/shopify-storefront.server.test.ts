import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock ioredis (same shape as redis-cache.server.test.ts) so withCache's L2
// layer has a backing store during these tests.
// ---------------------------------------------------------------------------
vi.mock("ioredis", () => {
  const store = new Map<string, string>();
  return {
    Redis: class MockRedis {
      static __store = store;
      static __clear() {
        store.clear();
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
      set(key: string, value: string, ..._args: unknown[]) {
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

describe("executeStorefrontRequest", () => {
  let executeStorefrontRequest: typeof import("../shopify-storefront.server").executeStorefrontRequest;
  let getStorefrontConfig: typeof import("../shopify-storefront.server").getStorefrontConfig;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.SHOPIFY_STOREFRONT_DOMAIN = "test-shop.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "public-token";
    process.env.SHOPIFY_STOREFRONT_API_VERSION = "2026-07";
    process.env.SHOPIFY_GRAPHQL_CACHE_TTL = "60";

    const mod = await import("../shopify-storefront.server");
    executeStorefrontRequest = mod.executeStorefrontRequest;
    getStorefrontConfig = mod.getStorefrontConfig;

    const MockRedis = (await import("ioredis")).Redis as unknown as {
      __clear: () => void;
    };
    MockRedis.__clear();

    fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: { collection: { title: "Test" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getStorefrontConfig reads domain + token + version from env", () => {
    expect(getStorefrontConfig()).toEqual({
      domain: "test-shop.myshopify.com",
      token: "public-token",
      apiVersion: "2026-07",
    });
  });

  it("getStorefrontConfig returns null when the domain is missing", () => {
    delete process.env.SHOPIFY_STOREFRONT_DOMAIN;
    expect(getStorefrontConfig()).toBeNull();
  });

  it("calls the Storefront API (not Admin) with the public token header", async () => {
    await executeStorefrontRequest("query { collection { title } }", undefined, "default");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test-shop.myshopify.com/api/2026-07/graphql.json");
    expect(init.headers["X-Shopify-Storefront-Access-Token"]).toBe("public-token");
    // Must NOT send an Admin token.
    expect(init.headers["X-Shopify-Access-Token"]).toBeUndefined();
  });

  it("MISS then HIT — second identical call is served from cache (no second fetch)", async () => {
    const q = "query { collection { title } }";

    const first = await executeStorefrontRequest(q, { id: "1" }, "default");
    expect(first.cacheStatus).toBe("MISS");
    expect(first.response).toEqual({ data: { collection: { title: "Test" } } });

    const second = await executeStorefrontRequest(q, { id: "1" }, "default");
    expect(second.cacheStatus).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledOnce(); // still only one Shopify call
  });

  it("does not cache GraphQL error responses", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ errors: [{ message: "boom" }] }),
    });

    const q = "query { broken }";
    const first = await executeStorefrontRequest(q, undefined, "default");
    expect(first.cacheStatus).toBe("MISS");

    // Error was not cached → second call fetches again.
    const second = await executeStorefrontRequest(q, undefined, "default");
    expect(second.cacheStatus).toBe("MISS");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an error response (and does not fetch) when not configured", async () => {
    delete process.env.SHOPIFY_STOREFRONT_DOMAIN;

    const result = await executeStorefrontRequest("query { x }", undefined, "default");
    expect(result.shopifyStatus).toBe(0);
    expect(result.response.errors?.[0]?.message).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
