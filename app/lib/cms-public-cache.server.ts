import { cacheDel, cacheDelByPrefix } from "./redis-cache.server";

/**
 * Redis/L1 keys for public CMS JSON (native GET /cms/pages).
 *
 *   cms:pages:{shop}:list
 *   cms:pages:{shop}:slug:{slug}
 */
export const CMS_PAGES_CACHE_PREFIX = "cms:pages:";

export function normalizeShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function cmsPagesCachePrefix(shop: string): string {
  return `${CMS_PAGES_CACHE_PREFIX}${normalizeShopDomain(shop)}:`;
}

export function cmsPagesListCacheKey(shop: string): string {
  return `${cmsPagesCachePrefix(shop)}list`;
}

export function cmsPageSlugCacheKey(shop: string, slug: string): string {
  return `${cmsPagesCachePrefix(shop)}slug:${slug.trim().toLowerCase()}`;
}

export function cmsSettingsCacheKey(shop: string): string {
  return `cms:settings:${normalizeShopDomain(shop)}`;
}

/** Drop list + all slugs for a shop (publish, unpublish, header/footer edits). */
export async function invalidateCmsPublicCache(shop: string): Promise<number> {
  return cacheDelByPrefix(cmsPagesCachePrefix(shop));
}

export async function invalidateCmsSettingsCache(shop: string): Promise<number> {
  await cacheDel(cmsSettingsCacheKey(shop));
  return 1;
}
