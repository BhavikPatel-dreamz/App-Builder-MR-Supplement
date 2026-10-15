/**
 * Centralized environment configuration for the catalog API layer.
 */

function readInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const config = {
  /** Base URL for this app (used in health/demo links). */
  appUrl: process.env.SHOPIFY_APP_URL || "http://localhost:3000",

  redis: {
    url: process.env.REDIS_URL || "",
  },

  cache: {
    productTtl: readInt("CACHE_TTL_PRODUCT", 120),
    collectionTtl: readInt("CACHE_TTL_COLLECTION", 60),
    productListTtl: readInt("CACHE_TTL_PRODUCT_LIST", 30),
    searchTtl: readInt("CACHE_TTL_SEARCH", 15),
    swrMultiplier: readInt("CACHE_SWR_MULTIPLIER", 2),
  },

  shopify: {
    apiVersion: process.env.SHOPIFY_ADMIN_API_VERSION || "2026-07",
    maxRetries: readInt("SHOPIFY_MAX_RETRIES", 3),
    requestTimeoutMs: readInt("SHOPIFY_REQUEST_TIMEOUT_MS", 30_000),
    storefrontTimeoutMs: readInt(
      "SHOPIFY_STOREFRONT_TIMEOUT_MS",
      readInt("SHOPIFY_REQUEST_TIMEOUT_MS", 15_000),
    ),
  },

  queue: {
    enabled: process.env.QUEUE_ENABLED === "1",
    redisUrl: process.env.REDIS_URL || "",
    prefix: process.env.QUEUE_PREFIX || "app-builder-xyxx",
  },
} as const;

export type AppConfig = typeof config;
