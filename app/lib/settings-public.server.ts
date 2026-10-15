import {
  getCacheTTL,
  withCache,
} from "./redis-cache.server";
import { cmsSettingsCacheKey } from "./cms-public-cache.server";
import {
  cmsOptionsResponse,
  parseCacheMode,
  publicCachedJson,
  resolvePublicCmsShop,
} from "./cms-public.server";
import { getShopSettings, toPublicShopSettings } from "./settings.server";
import { ensureRuntimeCachePolicy } from "./cache-policy.server";
import { recordPublicCacheAccess } from "./cache-store.server";

export { cmsOptionsResponse };

export async function servePublicSettings(request: Request): Promise<Response> {
  const started = Date.now();
  const shop = resolvePublicCmsShop(request);
  await ensureRuntimeCachePolicy(shop);
  if (!shop) {
    return publicCachedJson(
      { error: "Shop could not be resolved. Set SHOPIFY_STOREFRONT_DOMAIN or pass ?shop=." },
      400,
      false,
      "MISS",
      Date.now() - started,
    );
  }

  const mode = parseCacheMode(request);
  const { data, cacheStatus, timings } = await withCache(
    cmsSettingsCacheKey(shop),
    mode,
    async () => {
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
    },
  );

  void recordPublicCacheAccess(request, cacheStatus);
  return publicCachedJson(
    data,
    200,
    mode === "default",
    cacheStatus,
    Date.now() - started,
    timings,
  );
}
