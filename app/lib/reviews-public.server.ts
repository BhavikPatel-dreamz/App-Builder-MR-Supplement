import { ensureRuntimeCachePolicy } from "./cache-policy.server";
import { recordPublicCacheAccess } from "./cache-store.server";
import { reviewsGetCacheKey } from "./cms-public-cache.server";
import {
  parseCacheMode,
  publicCachedJson,
} from "./cms-public.server";
import { withCache } from "./redis-cache.server";
import { paginateReviews, parseReviewPage } from "./reviews-format";
import {
  getProductReviews,
  readReviewFields,
  resolveReviewShop,
  reviewJson,
  reviewOptions,
} from "./reviews.server";

type ReviewsGetBody = {
  success: true;
  reviews_counts: number;
  average_star: number;
  reviews: unknown[];
};

/**
 * GET /reviews/get — Redis L1/L2 plus Cache-Control for Vercel/Cloudflare.
 * Optional: ?shop= ?product_id= ?page= ?cache=default|bypass|refresh
 * The full list is cached once per product. Each response returns 20 reviews.
 */
export async function serveProductReviews(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return reviewOptions();
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD") {
    return reviewJson({ success: false, message: "Use GET /reviews/get." }, 405);
  }

  const started = Date.now();
  const shop = resolveReviewShop(request);
  await ensureRuntimeCachePolicy(shop);
  if (!shop) {
    return publicCachedJson(
      {
        success: false,
        message: "Shop could not be resolved. Set OTA_SHOP or pass ?shop=store.myshopify.com.",
      },
      400,
      false,
      "MISS",
      Date.now() - started,
    );
  }

  const fields = await readReviewFields(request);
  const productId = String(fields.product_id ?? "").trim();
  if (!productId) {
    return publicCachedJson(
      { success: "false", message: "Product Id id are required." },
      200,
      false,
      "MISS",
      Date.now() - started,
    );
  }

  const edgeCacheable = request.method === "GET" || request.method === "HEAD";
  const mode = edgeCacheable ? parseCacheMode(request) : "default";

  try {
    const { data, cacheStatus, timings } = await withCache<ReviewsGetBody | null>(
      reviewsGetCacheKey(shop, productId),
      mode,
      async () => {
        const result = await getProductReviews(shop, productId);
        if (result.notFound) return null;
        return {
          success: true,
          reviews_counts: result.reviews_counts,
          average_star: result.average_star,
          reviews: result.reviews,
        };
      },
      { shouldCache: (body) => body !== null },
    );

    void recordPublicCacheAccess(request, cacheStatus);
    if (!data) {
      return publicCachedJson(
        { success: false, message: "Product not found.", reviews: [] },
        404,
        false,
        cacheStatus,
        Date.now() - started,
        timings,
      );
    }
    const page = paginateReviews(data.reviews, parseReviewPage(fields.page));
    return publicCachedJson(
      {
        success: true,
        reviews_counts: data.reviews_counts,
        average_star: data.average_star,
        page: page.page,
        per_page: page.per_page,
        total_pages: page.total_pages,
        reviews: page.reviews,
      },
      200,
      edgeCacheable && mode === "default",
      cacheStatus,
      Date.now() - started,
      timings,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review request failed.";
    console.error("[reviews]", message);
    return publicCachedJson(
      { success: false, message },
      500,
      false,
      "MISS",
      Date.now() - started,
    );
  }
}
