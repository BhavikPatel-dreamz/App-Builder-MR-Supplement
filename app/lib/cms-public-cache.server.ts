import { cacheDel, cacheDelByPrefix, withCache, getCacheTTL } from "./redis-cache.server";
import { purgeIndiaEdge, purgeAndWarmIndiaEdge } from "./india-edge.server";
import { reviewProductCacheId } from "./reviews-format";

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
  return `cms:settings:v5:${normalizeShopDomain(shop)}`;
}

export function reviewsGetCachePrefix(shop: string): string {
  return `reviews:get:v1:${normalizeShopDomain(shop)}:`;
}

export function reviewsGetCacheKey(shop: string, productId: string): string {
  return `${reviewsGetCachePrefix(shop)}${reviewProductCacheId(productId)}`;
}

export function reviewsGetPublicUrls(shop: string, productId: string): string[] {
  const origin = publicCmsOrigin();
  const ids = new Set(
    [reviewProductCacheId(productId), productId.trim()].filter(Boolean),
  );
  const shopDomain = normalizeShopDomain(shop);
  const urls: string[] = [];
  for (const id of ids) {
    const base = `${origin}/reviews/get?product_id=${encodeURIComponent(id)}`;
    urls.push(base);
    if (shopDomain) urls.push(`${base}&shop=${encodeURIComponent(shopDomain)}`);
  }
  return urls;
}

/** Drop the Redis entry and the CDN/India copies for one product. */
export async function invalidateProductReviewsCache(
  shop: string,
  productId: string,
): Promise<void> {
  try {
    await cacheDel(reviewsGetCacheKey(shop, productId));
    const urls = reviewsGetPublicUrls(shop, productId);
    const { getCdnProvider } = await import("./protection/cdn-provider.server");
    await getCdnProvider().purge({ urls });
    await purgeIndiaEdge(urls);
  } catch (err) {
    console.error(
      "[reviews-cache] invalidate failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

function publicCmsOrigin(): string {
  return (process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com").replace(
    /\/$/,
    "",
  );
}

function publicCmsUrls(slug?: string): string[] {
  const origin = publicCmsOrigin();
  const shop = process.env.SHOPIFY_STOREFRONT_DOMAIN
    ? normalizeShopDomain(process.env.SHOPIFY_STOREFRONT_DOMAIN)
    : "";
  const urls = [`${origin}/cms/pages`];
  if (slug) {
    const encoded = encodeURIComponent(slug);
    const path = `${origin}/cms/pages/${encoded}`;
    urls.push(path, `${path}/`);
    if (shop) urls.push(`${path}?shop=${encodeURIComponent(shop)}`);
  }
  return urls;
}

async function purgePublicCmsCdn(urls: string[]): Promise<void> {
  try {
    const { getCdnProvider } = await import("./protection/cdn-provider.server");
    await getCdnProvider().purge({ urls });
    const { fillCloudflareCache } = await import("./catalog-warm.server");
    await fillCloudflareCache(urls);
  } catch (err) {
    console.error(
      "[cms-cache] cdn purge/fill failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function rewarmAndPropagatePages(shop: string, slug?: string): Promise<void> {
  try {
    const { listPublishedPages, getPublishedPageBySlug } = await import("./cms.server");
    await withCache(cmsPagesListCacheKey(shop), "refresh", async () => {
      const pages = await listPublishedPages(shop);
      return { success: true as const, pages };
    });
    if (slug) {
      await withCache(
        cmsPageSlugCacheKey(shop, slug),
        "refresh",
        () => getPublishedPageBySlug(shop, slug),
        { shouldCache: (page) => page !== null },
      );
    }
    const urls = publicCmsUrls(slug);
    await purgePublicCmsCdn(urls);
    await purgeAndWarmIndiaEdge(urls);
  } catch (err) {
    console.error(
      "[cms-cache] pages propagate failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function rewarmAndPropagateSettings(shop: string): Promise<void> {
  try {
    const { getShopSettings, toPublicShopSettings } = await import("./settings.server");
    await withCache(cmsSettingsCacheKey(shop), "refresh", async () => {
      const settings = await getShopSettings(shop);
      const publicSettings = toPublicShopSettings(settings);
      return {
        success: true as const,
        bottomTab: publicSettings.bottomTab,
        homePage: publicSettings.homePage,
        cart: publicSettings.cart,
        search: publicSettings.search,
        productDetails: publicSettings.productDetails,
        appstle: publicSettings.appstle,
        trustpilot: publicSettings.trustpilot,
        reviews: publicSettings.reviews,
        settings: publicSettings,
        todaysMeditation: publicSettings.todaysMeditation,
        todaysAffirmation: publicSettings.todaysAffirmation,
        cacheTtlSeconds: getCacheTTL(),
      };
    });
    await purgePublicCmsCdn([`${publicCmsOrigin()}/cms/settings`]);
    await purgeAndWarmIndiaEdge([`${publicCmsOrigin()}/cms/settings`]);
  } catch (err) {
    console.error(
      "[cms-cache] settings propagate failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Drop list + all slugs for a shop (publish, unpublish, header/footer edits). */
export async function invalidateCmsPublicCache(
  shop: string,
  slug?: string,
): Promise<number> {
  const n = await cacheDelByPrefix(cmsPagesCachePrefix(shop));
  await rewarmAndPropagatePages(shop, slug);
  return n;
}

export async function invalidateCmsSettingsCache(shop: string): Promise<number> {
  await cacheDel(cmsSettingsCacheKey(shop));
  await rewarmAndPropagateSettings(shop);
  return 1;
}
