/**
 * Phase 3 — GraphQL gateway protection configuration (CDN-independent).
 */

function readInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const protectionConfig = {
  rateLimit: {
    /** Soft ceiling for all /graphql requests per IP (cached traffic allowed). */
    ipPerMinute: readInt("GRAPHQL_RATE_LIMIT_IP_PER_MIN", 1200),
    /** Stricter limit when a request will call Shopify (cache MISS path). */
    shopifyMissPerIpMinute: readInt("GRAPHQL_RATE_LIMIT_SHOPIFY_MISS_PER_MIN", 120),
    /** Per cache-key Shopify miss limit (prevents unique-query abuse). */
    cacheKeyPerMinute: readInt("GRAPHQL_RATE_LIMIT_CACHE_KEY_PER_MIN", 60),
    /** Global Shopify outbound cap across all clients/keys. */
    shopifyGlobalPerMinute: readInt("GRAPHQL_RATE_LIMIT_SHOPIFY_GLOBAL_PER_MIN", 600),
    /** In-process fallback when Redis is unavailable (per server). */
    localShopifyPerMinute: readInt("GRAPHQL_RATE_LIMIT_LOCAL_SHOPIFY_PER_MIN", 120),
  },

  lock: {
    ttlSeconds: readInt("CACHE_LOCK_TTL_SECONDS", 30),
    waitMs: readInt("CACHE_LOCK_WAIT_MS", 250),
    pollMs: readInt("CACHE_LOCK_POLL_MS", 50),
  },

  storefront: {
    timeoutMs: readInt(
      "SHOPIFY_STOREFRONT_TIMEOUT_MS",
      readInt("SHOPIFY_REQUEST_TIMEOUT_MS", 15_000),
    ),
    maxRetries: readInt("SHOPIFY_MAX_RETRIES", 3),
  },

  circuitBreaker: {
    failureThreshold: readInt("SHOPIFY_CB_FAILURE_THRESHOLD", 5),
    openMs: readInt("SHOPIFY_CB_OPEN_MS", 30_000),
    halfOpenMax: readInt("SHOPIFY_CB_HALF_OPEN_MAX", 2),
  },

  graphql: {
    maxQueryLength: readInt("GRAPHQL_MAX_QUERY_LENGTH", 12_000),
    maxVariablesJsonLength: readInt("GRAPHQL_MAX_VARIABLES_LENGTH", 8_000),
    maxUrlLength: readInt("GRAPHQL_MAX_URL_LENGTH", 16_000),
    requirePersistedQueries: readBool("GRAPHQL_REQUIRE_PERSISTED_QUERIES", false),
  },
} as const;

export type ProtectionConfig = typeof protectionConfig;
