export type InternalReview = {
  rSource?: string;
  rName?: string;
  rLocation?: string;
  rContent?: string;
  rCreated?: string;
  /** Legacy Magento/import dumps use these instead of rCreated / rPoints. */
  rCreatedDate?: string;
  rUpdatedDate?: string;
  rPoints?: number | string;
  rraRating?: number | string;
  rating?: number | string;
  variant_name?: string;
  createdAt?: string;
  id?: string;
  consumer?: { displayName?: string };
  content?: string;
  stars?: number;
  [key: string]: unknown;
};

export type PublicReview = {
  rSource: "trustpilot" | "internal";
  rName: string;
  rLocation: string;
  rContent: string;
  rCreated: string;
  rPoints: number | string;
  variant_name: string;
};

/** Numeric Shopify product id, so `123` and `gid://shopify/Product/123` share one cache entry. */
export function reviewProductCacheId(productId: string): string {
  const id = productId.trim();
  const fromGid = /\/Product\/([^/]+)$/.exec(id);
  return fromGid?.[1] || id;
}

export function toProductGid(productId: string): string {
  const id = productId.trim();
  if (!id) return "";
  if (id.startsWith("gid://shopify/Product/")) return id;
  return `gid://shopify/Product/${id}`;
}

export function toVariantGid(variantId: string): string {
  const id = variantId.trim();
  if (!id) return "";
  if (id.startsWith("gid://shopify/ProductVariant/")) return id;
  return `gid://shopify/ProductVariant/${id}`;
}

export function productHostFromSetting(value: string): string {
  const trimmed = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return trimmed || "www.mrsupplement.com.au";
}

export function oldProductUrl(host: string, handle: string): string {
  return `https://${productHostFromSetting(host)}/${handle}`;
}

/** Settings often store https://api.trustpilot.com/v1/. The review path adds /v1 itself. */
export function trustpilotApiRoot(baseUrl: string): string {
  const fallback = "https://api.trustpilot.com";
  let root = baseUrl.trim().replace(/\/+$/, "");
  if (!root) return fallback;
  root = root.replace(/\/v1$/i, "");
  return root || fallback;
}

function reviewPoints(value: unknown): number {
  const points = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(points) ? points : 0;
}

/** Always a finite number. A text rating counts as 0, matching the old PHP sum. */
export function averageStar(reviews: Array<{ rPoints?: unknown }>): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + reviewPoints(review.rPoints), 0);
  const average = Math.round((total / reviews.length) * 10) / 10;
  return Number.isFinite(average) ? average : 0;
}

export function oldIdFromTags(tags: string[]): string {
  for (const tag of tags) {
    const match = /^old_(.+)_id$/.exec(tag);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function variantLabel(variant: {
  title?: string | null;
  selectedOptions?: Array<{ value?: string | null }> | null;
} | null): string {
  const options = (variant?.selectedOptions ?? [])
    .map((option) => option.value?.trim() || "")
    .filter(Boolean);
  if (options.length > 0) return options.join(" / ");
  return variant?.title?.trim() || "";
}

function asReviewArray(value: unknown): InternalReview[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as InternalReview[];
}

export function parseStoredReviews(value: string | null | undefined): InternalReview[] {
  if (!value) return [];
  try {
    const decoded = JSON.parse(value) as unknown;
    if (Array.isArray(decoded)) return asReviewArray(decoded);
    if (decoded && typeof decoded === "object") return [decoded as InternalReview];
  } catch {
    return [];
  }
  return [];
}

/** Prefer canonical fields, then legacy import keys (rraRating / rCreatedDate). */
export function internalReviewPoints(review: InternalReview): number {
  for (const value of [review.rPoints, review.rraRating, review.rating, review.stars]) {
    if (value === undefined || value === null || value === "") continue;
    const points = typeof value === "number" ? value : Number(String(value).trim());
    if (Number.isFinite(points)) return points;
  }
  return 0;
}

export function internalReviewCreated(review: InternalReview): string {
  for (const value of [
    review.rCreated,
    review.rCreatedDate,
    review.createdAt,
    review.rUpdatedDate,
  ]) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function mapPublicReview(review: InternalReview): PublicReview {
  if (review.id) {
    return {
      rSource: "trustpilot",
      rName: review.consumer?.displayName ?? "",
      rLocation: "",
      rContent: review.content ?? "",
      rCreated: review.createdAt ?? "",
      rPoints: review.stars ?? 0,
      variant_name: "",
    };
  }
  return {
    rSource: "internal",
    rName: String(review.rName ?? ""),
    rLocation: String(review.rLocation ?? ""),
    rContent: String(review.rContent ?? ""),
    rCreated: internalReviewCreated(review),
    rPoints: internalReviewPoints(review),
    variant_name: String(review.variant_name ?? ""),
  };
}

function reviewTime(review: InternalReview): number {
  const raw = internalReviewCreated(review);
  // "2011-01-11 00:00:00" is not always ISO; Date.parse handles it in V8.
  const time = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  return Number.isNaN(time) ? 0 : time;
}

export const REVIEWS_PER_PAGE = 20;

/** Blank page means the full list, matching the old get_reviews.php response. */
export function parseReviewPage(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const page = Number.parseInt(String(value), 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return page;
}

/** Slice a cached full list. Totals stay on the whole list; `reviews` is one page. */
export function paginateReviews<T>(reviews: T[], page: number, perPage = REVIEWS_PER_PAGE) {
  const size = perPage > 0 ? perPage : REVIEWS_PER_PAGE;
  const current = page < 1 ? 1 : page;
  const start = (current - 1) * size;
  const total = reviews.length;
  return {
    reviews: reviews.slice(start, start + size),
    page: current,
    per_page: size,
    total_pages: total === 0 ? 0 : Math.ceil(total / size),
    reviews_counts: total,
  };
}

export function mergeReviews(
  internalReviews: InternalReview[],
  liveReviews: InternalReview[],
): { reviews: PublicReview[]; reviews_counts: number; average_star: number } {
  const kept = internalReviews.filter((review) => review.rSource !== "trustpilot");
  const combined = [...kept, ...liveReviews].sort(
    (a, b) => reviewTime(b) - reviewTime(a),
  );
  const reviews = combined.map(mapPublicReview);
  return {
    reviews,
    reviews_counts: reviews.length,
    average_star: averageStar(reviews),
  };
}
