import { getCacheTTL } from "./redis-cache.server";
import { executeStorefrontRequest } from "./shopify-storefront.server";

// ---------------------------------------------------------------------------
// Cache warmer (opt-in) — keeps the hot query permanently warm
//
// The main collection is the hot path; a cold miss on it makes a user pay the
// full India↔US round-trip to Shopify. This warmer re-fetches it just before
// its TTL expires so there is always a fresh entry in Redis (and, when edge
// caching is enabled, the origin fill is instant). Stale-while-revalidate
// already softens the expiry cliff; this is the belt-and-suspenders on top.
//
// OFF by default. Enable in production with `GRAPHQL_WARM=1`. Never runs under
// Vitest. Started lazily from the /graphql route so it works even for a
// headless/API-only deployment (no SSR document request required to boot it).
// ---------------------------------------------------------------------------

const HOT_QUERY = `query ProductsByCollectionId($id: ID!, $first: Int, $after: String) {
  collection(id: $id) {
    title
    handle
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title handle } }
    }
  }
}`;

const DEFAULT_COLLECTION_ID = "568648040759";

let started = false;

function isEnabled(): boolean {
  return process.env.GRAPHQL_WARM === "1" && !process.env.VITEST;
}

async function warmOnce(): Promise<void> {
  const collectionId = process.env.GRAPHQL_WARM_COLLECTION_ID || DEFAULT_COLLECTION_ID;
  const variables = {
    id: `gid://shopify/Collection/${collectionId}`,
    first: 250,
    after: null,
  };
  try {
    // `refresh` overwrites both cache layers with a fresh Shopify response.
    const { durationMs, shopifyStatus } = await executeStorefrontRequest(
      HOT_QUERY,
      variables,
      "refresh",
    );
    console.log(
      `[cache-warmer] warmed collection=${collectionId} status=${shopifyStatus} ms=${durationMs}`,
    );
  } catch (err) {
    console.error(
      "[cache-warmer] warm failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Start the background warmer exactly once, and only when enabled. Safe to call
 * on every request — it is a cheap guarded no-op after the first start.
 */
export function ensureCacheWarmerStarted(): void {
  if (started || !isEnabled()) return;
  started = true;

  // Refresh a little before the entry would go stale so it never expires.
  const intervalSec = Math.max(30, getCacheTTL() - 30);
  console.log(`[cache-warmer] enabled — warming every ${intervalSec}s`);

  // Warm immediately so the first user never hits a cold miss, then on interval.
  void warmOnce();
  const timer = setInterval(() => void warmOnce(), intervalSec * 1000);
  // Do not keep the event loop alive solely for warming.
  if (typeof timer.unref === "function") timer.unref();
}
