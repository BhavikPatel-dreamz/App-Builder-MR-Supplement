import type { CacheMode, CacheStatus, CacheTimings } from "./redis-cache.server";
import {
  withCache,
} from "./redis-cache.server";
import { isValidCacheMode } from "./shopify-graphql-types.server";
import {
  applyCdnCacheHeaders,
  ensureRuntimeCachePolicy,
  publicCacheControlValue,
} from "./cache-policy.server";
import { recordPublicCacheAccess } from "./cache-store.server";
import {
  getPublishedPageBySlug,
  listPublishedPages,
  type PublicPageListItem,
  type PublicPageRecord,
} from "./cms.server";
import {
  cmsPageSlugCacheKey,
  cmsPagesListCacheKey,
  normalizeShopDomain,
} from "./cms-public-cache.server";

export const DEFAULT_CMS_PAGES_URL =
  "https://appbuilder.dreamzapps.com/cms/pages";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Cache, X-Proxy-Duration-Ms, Server-Timing",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function corsHeaders(cacheable: boolean): Record<string, string> {
  if (!cacheable) return { ...CORS_HEADERS };
  const headers = { ...CORS_HEADERS };
  delete headers.Vary;
  return headers;
}

function serverTiming(timings?: CacheTimings): string {
  if (!timings) return "";
  const parts: string[] = [];
  if (timings.l1Ms > 0) parts.push(`l1;dur=${timings.l1Ms}`);
  if (timings.l2Ms > 0) parts.push(`l2;dur=${timings.l2Ms}`);
  if (timings.fetchMs > 0) parts.push(`origin;dur=${timings.fetchMs}`);
  parts.push(`total;dur=${timings.totalMs}`);
  return parts.join(", ");
}

/**
 * Shop for public CMS reads: `?shop=` or `SHOPIFY_STOREFRONT_DOMAIN`
 * (same env as /graphql).
 */
export function resolvePublicCmsShop(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("shop");
  const fromEnv = process.env.SHOPIFY_STOREFRONT_DOMAIN;
  const raw = (fromQuery || fromEnv || "").trim();
  if (!raw) return null;
  return normalizeShopDomain(raw);
}

export function parseCacheMode(request: Request): CacheMode {
  const value = new URL(request.url).searchParams.get("cache") ?? "default";
  return isValidCacheMode(value) ? value : "default";
}

export function cmsOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function publicCachedJson(
  body: unknown,
  status: number,
  cacheable: boolean,
  cacheStatus: CacheStatus,
  durationMs: number,
  timings?: CacheTimings,
  /** Pages and settings: the app must revalidate. Redis still keeps the long TTL. */
  revalidateClient = false,
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders(cacheable),
    "Content-Type": "application/json",
    "X-Cache": cacheStatus,
    "X-Proxy-Duration-Ms": String(durationMs),
  };
  if (cacheable && revalidateClient) {
    headers["Cache-Control"] = "public, max-age=0, must-revalidate";
  } else if (cacheable) {
    headers["Cache-Control"] = publicCacheControlValue();
    applyCdnCacheHeaders(headers);
  } else {
    headers["Cache-Control"] = "no-store";
  }
  const timing = serverTiming(timings);
  if (timing) headers["Server-Timing"] = timing;
  return Response.json(body, { status, headers });
}

export type PublicPageListBody = {
  success: true;
  pages: PublicPageListItem[];
};

export async function servePublicPageList(request: Request): Promise<Response> {
  await ensureRuntimeCachePolicy(resolvePublicCmsShop(request));
  const started = Date.now();
  const shop = resolvePublicCmsShop(request);
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
  const { data, cacheStatus, timings } = await withCache<PublicPageListBody>(
    cmsPagesListCacheKey(shop),
    mode,
    async () => {
      const pages = await listPublishedPages(shop);
      return { success: true, pages };
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
    true,
  );
}

export async function servePublicPageBySlug(
  request: Request,
  slug: string | undefined,
): Promise<Response> {
  await ensureRuntimeCachePolicy(resolvePublicCmsShop(request));
  const started = Date.now();
  const shop = resolvePublicCmsShop(request);
  if (!shop) {
    return publicCachedJson(
      { error: "Shop could not be resolved. Set SHOPIFY_STOREFRONT_DOMAIN or pass ?shop=." },
      400,
      false,
      "MISS",
      Date.now() - started,
    );
  }

  const cleanSlug = (slug ?? "").trim();
  if (!cleanSlug) {
    return publicCachedJson(
      { error: "Page slug is required." },
      400,
      false,
      "MISS",
      Date.now() - started,
    );
  }

  const mode = parseCacheMode(request);
  const { data, cacheStatus, timings } = await withCache<PublicPageRecord | null>(
    cmsPageSlugCacheKey(shop, cleanSlug),
    mode,
    () => getPublishedPageBySlug(shop, cleanSlug),
    { shouldCache: (page) => page !== null },
  );

  if (!data) {
    void recordPublicCacheAccess(request, cacheStatus);
    return publicCachedJson(
      { error: "Page not found." },
      404,
      false,
      cacheStatus,
      Date.now() - started,
      timings,
    );
  }

  void recordPublicCacheAccess(request, cacheStatus);
  return publicCachedJson(
    data,
    200,
    mode === "default",
    cacheStatus,
    Date.now() - started,
    timings,
    true,
  );
}
