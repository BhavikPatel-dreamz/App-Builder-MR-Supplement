import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  PRODUCTS_BY_COLLECTION_FULL_QUERY,
  COLLECTION_VARIABLES_PAGE1,
  sampleShopifyCollectionResponse,
} from "../__fixtures__/shopify-collection-query";
import { buildCacheKey } from "../redis-cache.server";
import { deepEqualJson } from "../graphql-response.server";

vi.mock("ioredis", () => {
  const store = new Map<string, string>();
  const locks = new Map<string, string>();

  return {
    Redis: class MockRedis {
      static __clear() {
        store.clear();
        locks.clear();
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
        if (args.includes("NX")) {
          if (locks.has(key)) return Promise.resolve(null);
          locks.set(key, value);
          return Promise.resolve("OK");
        }
        store.set(key, value);
        return Promise.resolve("OK");
      }
      del(key: string) {
        store.delete(key);
        locks.delete(key);
        return Promise.resolve(1);
      }
      incr(key: string) {
        return Promise.resolve(1);
      }
      expire() {
        return Promise.resolve(1);
      }
      eval(_s: string, _n: number, key: string, token: string) {
        if (locks.get(key) === token) {
          locks.delete(key);
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      }
      scan() {
        return Promise.resolve(["0", []] as [string, string[]]);
      }
    },
  };
});

describe("GraphQL gateway contract — transparent Shopify passthrough", () => {
  let executeStorefrontRequest: typeof import("../shopify-storefront.server").executeStorefrontRequest;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.SHOPIFY_STOREFRONT_DOMAIN = "riyaasat-official.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "test-token";
    process.env.SHOPIFY_GRAPHQL_CACHE_TTL = "1800";
    process.env.GRAPHQL_RATE_LIMIT_IP_PER_MIN = "100000";
    process.env.GRAPHQL_RATE_LIMIT_SHOPIFY_MISS_PER_MIN = "100000";
    process.env.GRAPHQL_RATE_LIMIT_CACHE_KEY_PER_MIN = "100000";
    process.env.GRAPHQL_RATE_LIMIT_SHOPIFY_GLOBAL_PER_MIN = "100000";
    process.env.SHOPIFY_MAX_RETRIES = "0";

    const { Redis } = await import("ioredis");
    (Redis as unknown as { __clear: () => void }).__clear();

    const mod = await import("../shopify-storefront.server");
    executeStorefrontRequest = mod.executeStorefrontRequest;

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes query and variables to Shopify unmodified", async () => {
    const shopifyBody = sampleShopifyCollectionResponse();
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => shopifyBody,
    });

    await executeStorefrontRequest(
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      COLLECTION_VARIABLES_PAGE1,
      "bypass",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as {
      query: string;
      variables: Record<string, unknown>;
    };

    expect(sent.query).toBe(PRODUCTS_BY_COLLECTION_FULL_QUERY);
    expect(sent.variables).toEqual(COLLECTION_VARIABLES_PAGE1);
    expect(sent.variables.first).toBe(250);
    expect(sent.variables.after).toBeNull();
    expect(sent.variables.filters).toEqual([]);
    expect(sent.variables.sortKey).toBe("COLLECTION_DEFAULT");
    expect(sent.variables.reverse).toBe(false);
  });

  it("returns exact Shopify JSON body including data, extensions, nested fields", async () => {
    const shopifyBody = sampleShopifyCollectionResponse();
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => shopifyBody,
    });

    const result = await executeStorefrontRequest(
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      COLLECTION_VARIABLES_PAGE1,
      "bypass",
    );

    expect(deepEqualJson(result.response, shopifyBody)).toBe(true);
    expect(result.response.data?.collection?.products?.pageInfo?.endCursor).toBe(
      "eyJsYXN0X2lkIjo123",
    );
    expect(result.response.data?.collection?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node?.price?.amount).toBe(
      "1000.0",
    );
    expect(result.response.extensions?.cost?.actualQueryCost).toBe(50);
  });

  it("cache HIT returns identical JSON to first Shopify response", async () => {
    const shopifyBody = sampleShopifyCollectionResponse();
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => shopifyBody,
    });

    const first = await executeStorefrontRequest(
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      COLLECTION_VARIABLES_PAGE1,
      "default",
    );
    expect(first.cacheStatus).toBe("MISS");

    const second = await executeStorefrontRequest(
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      COLLECTION_VARIABLES_PAGE1,
      "default",
    );
    expect(second.cacheStatus).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(deepEqualJson(first.response, second.response)).toBe(true);
    expect(deepEqualJson(second.response, shopifyBody)).toBe(true);
  });

  it("preserves Shopify GraphQL errors without REST transformation", async () => {
    const shopifyError = {
      data: null,
      errors: [{ message: "Field 'unknown' doesn't exist on type 'QueryRoot'" }],
    };
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => shopifyError,
    });

    const result = await executeStorefrontRequest(
      "query { unknown }",
      undefined,
      "bypass",
    );

    expect(deepEqualJson(result.response, shopifyError)).toBe(true);
    expect(result.shopifyStatus).toBe(200);
  });

  it("does not cache GraphQL error responses", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => ({ errors: [{ message: "bad query" }] }),
    });

    await executeStorefrontRequest("query { bad }", undefined, "default");
    await executeStorefrontRequest("query { bad }", undefined, "default");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses distinct cache keys for different pagination variables", () => {
    const key1 = buildCacheKey(
      "storefront:shop.myshopify.com",
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      COLLECTION_VARIABLES_PAGE1,
    );
    const key2 = buildCacheKey(
      "storefront:shop.myshopify.com",
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      {
        ...COLLECTION_VARIABLES_PAGE1,
        after: "eyJsYXN0X2lkIjo123",
      },
    );
    const key3 = buildCacheKey(
      "storefront:shop.myshopify.com",
      PRODUCTS_BY_COLLECTION_FULL_QUERY,
      { ...COLLECTION_VARIABLES_PAGE1, first: 50 },
    );

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it("does not send client cookies or expose token in response body", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { shop: { name: "X" } } }),
    });

    const result = await executeStorefrontRequest("query { shop { name } }", undefined, "bypass");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Cookie");
    expect(JSON.stringify(result.response)).not.toContain("test-token");
  });

  it("preserves Shopify HTTP status on non-200 responses", async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      headers: { get: () => "2" },
      json: async () => ({ errors: [{ message: "Throttled" }] }),
    });

    const result = await executeStorefrontRequest("query { shop { name } }", undefined, "bypass");

    expect(result.shopifyStatus).toBe(429);
    expect(result.response.errors?.[0]?.message).toBe("Throttled");
  });
});

describe("graphql-response helpers", () => {
  it("shouldCacheGraphqlResponse rejects errors and non-200", async () => {
    const { shouldCacheGraphqlResponse } = await import("../graphql-response.server");
    expect(shouldCacheGraphqlResponse({ data: { x: 1 } }, 200)).toBe(true);
    expect(shouldCacheGraphqlResponse({ errors: [{ message: "e" }] }, 200)).toBe(false);
    expect(shouldCacheGraphqlResponse({ data: { x: 1 } }, 500)).toBe(false);
  });
});
