import { cacheDelByPrefix } from "../redis-cache.server";

const STOREFRONT_GRAPHQL_PREFIX = "shopify:graphql:storefront:";

/**
 * Invalidate all Storefront GraphQL cache entries for a shop domain.
 * Targeted per-store — not a global flush.
 */
export async function invalidateStorefrontGraphqlCache(
  shopDomain: string,
): Promise<number> {
  const normalised = shopDomain.toLowerCase().trim();
  return cacheDelByPrefix(`${STOREFRONT_GRAPHQL_PREFIX}${normalised}:`);
}

/** Re-export catalog invalidation for webhook handlers. */
export { invalidateCatalogCache } from "../cache/catalog-cache.server";
