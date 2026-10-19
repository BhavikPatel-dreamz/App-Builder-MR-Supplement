export type InternalReview = {
  rSource?: string;
  rName?: string;
  rLocation?: string;
  rContent?: string;
  rCreated?: string;
  rPoints?: number | string;
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
    rCreated: String(review.rCreated ?? ""),
    rPoints: review.rPoints ?? 0,
    variant_name: String(review.variant_name ?? ""),
  };
}

function reviewTime(review: InternalReview): number {
  const raw = String(review.createdAt ?? review.rCreated ?? "");
  const time = Date.parse(raw);
  return Number.isNaN(time) ? 0 : time;
}

export const REVIEWS_PER_PAGE = 20;

export function parseReviewPage(value: unknown): number {
  const page = Number.parseInt(String(value ?? ""), 10);
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
  const total = reviews.reduce((sum, review) => sum + Number(review.rPoints || 0), 0);
  const average = reviews.length > 0 ? Math.round((total / reviews.length) * 10) / 10 : 0;
  return {
    reviews,
    reviews_counts: reviews.length,
    average_star: average,
  };
}
