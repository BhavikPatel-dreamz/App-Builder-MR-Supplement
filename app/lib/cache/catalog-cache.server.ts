import { createHash } from "crypto";

import { config } from "../config.server";
import {
  buildCacheKey as buildGraphqlCacheKey,
  cacheDelByPrefix,
  withCache,
  type CacheMode,
  type CacheStatus,
} from "../redis-cache.server";

export { type CacheMode, type CacheStatus };

const CATALOG_PREFIX = "catalog:v1";

export function productByHandleKey(storeId: string, handle: string): string {
  return `${CATALOG_PREFIX}:${storeId}:product:${handle}`;
}

export function productByIdKey(storeId: string, id: string): string {
  return `${CATALOG_PREFIX}:${storeId}:product:id:${id}`;
}

export function productListKey(storeId: string, queryHash: string): string {
  return `${CATALOG_PREFIX}:${storeId}:products:${queryHash}`;
}

export function collectionByHandleKey(storeId: string, handle: string): string {
  return `${CATALOG_PREFIX}:${storeId}:collection:${handle}`;
}

export function collectionProductsKey(
  storeId: string,
  handle: string,
  queryHash: string,
): string {
  return `${CATALOG_PREFIX}:${storeId}:collection:${handle}:products:${queryHash}`;
}

/** Re-export GraphQL cache key builder for existing proxy routes. */
export { buildGraphqlCacheKey as buildGraphqlCacheKey };

export function catalogCacheTtl(resource: "product" | "collection" | "list" | "search"): number {
  switch (resource) {
    case "product":
      return config.cache.productTtl;
    case "collection":
      return config.cache.collectionTtl;
    case "search":
      return config.cache.searchTtl;
    default:
      return config.cache.productListTtl;
  }
}

export function catalogCacheHeaders(
  resource: "product" | "collection" | "list" | "search",
): Record<string, string> {
  const ttl = catalogCacheTtl(resource);
  const swr = ttl * config.cache.swrMultiplier;
  return {
    "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${swr}`,
  };
}

/**
 * Cache-aside for catalog REST reads.
 * Miss → fetcher (PostgreSQL) — never Shopify.
 */
export async function catalogGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    mode?: CacheMode;
    shouldCache?: (value: T) => boolean;
  },
): Promise<{ data: T; cacheStatus: CacheStatus }> {
  const { data, cacheStatus } = await withCache(
    key,
    options?.mode ?? "default",
    fetcher,
    { shouldCache: options?.shouldCache ?? (() => true) },
  );
  return { data, cacheStatus };
}

export function queryHashFromParts(parts: Record<string, unknown>): string {
  const normalised = JSON.stringify(parts);
  return createHash("sha256").update(normalised).digest("hex").slice(0, 16);
}

/** Drop all catalog REST cache entries for a store (call after sync). */
export async function invalidateCatalogCache(storeId: string): Promise<number> {
  return cacheDelByPrefix(`${CATALOG_PREFIX}:${storeId}:`);
}
