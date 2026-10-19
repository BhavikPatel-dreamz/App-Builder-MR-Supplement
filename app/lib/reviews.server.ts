import { effectiveTrustpilot, getShopSettings } from "./settings.server";
import { unauthenticated } from "../shopify.server";
import { normalizeShopDomain } from "./cms-public-cache.server";
import {
  oldIdFromTags,
  oldProductUrl,
  parseStoredReviews,
  toProductGid,
  toVariantGid,
  variantLabel,
  mergeReviews,
  type InternalReview,
} from "./reviews-format";

const PRODUCT_QUERY = `#graphql
  query ProductReviews($id: ID!) {
    product(id: $id) {
      id
      handle
      tags
      metafields(first: 250) {
        edges {
          node {
            key
            value
          }
        }
      }
    }
  }
`;

const VARIANT_QUERY = `#graphql
  query ReviewVariant($id: ID!) {
    productVariant(id: $id) {
      id
      title
      selectedOptions {
        name
        value
      }
    }
  }
`;

const METAFIELDS_SET = `#graphql
  mutation SaveImportedReviews($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        key
        namespace
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const MAX_TRUSTPILOT_PAGES = 15;

export const REVIEW_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function reviewJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: REVIEW_CORS });
}

export function reviewOptions(): Response {
  return new Response(null, { status: 204, headers: REVIEW_CORS });
}

export async function readReviewFields(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const fields: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    fields[key] = value;
  });
  if (request.method === "GET" || request.method === "HEAD") return fields;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return { ...fields, ...body };
  }
  if (contentType.includes("form")) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") fields[key] = value;
    }
  }
  return fields;
}

export function resolveReviewShop(request: Request): string | null {
  const url = new URL(request.url);
  const raw = (
    url.searchParams.get("shop") ||
    process.env.OTA_SHOP ||
    process.env.SHOPIFY_STOREFRONT_DOMAIN ||
    ""
  ).trim();
  if (!raw) return null;
  return normalizeShopDomain(raw);
}

async function adminGraphql<T>(
  admin: AdminClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await admin.graphql(query, variables ? { variables } : undefined);
  return (await response.json()) as T;
}

function metafieldValue(
  edges: Array<{ node?: { key?: string; value?: string } }> | undefined,
  key: string,
): string {
  for (const edge of edges ?? []) {
    if (edge.node?.key === key) return edge.node.value ?? "";
  }
  return "";
}

async function trustpilotReviews(
  productUrl: string,
  apiKey: string,
  businessUnitId: string,
  baseUrl: string,
): Promise<InternalReview[]> {
  if (!apiKey || !businessUnitId || !productUrl) return [];
  const root = (baseUrl || "https://api.trustpilot.com").replace(/\/+$/, "");
  const live: InternalReview[] = [];
  for (let page = 1; page <= MAX_TRUSTPILOT_PAGES; page += 1) {
    const url = new URL(
      `${root}/v1/product-reviews/business-units/${businessUnitId}/reviews`,
    );
    url.searchParams.set("productUrl", productUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("perPage", "100");
    const response = await fetch(url, { headers: { apikey: apiKey } });
    if (!response.ok) break;
    const data = (await response.json()) as { productReviews?: InternalReview[] };
    const pageReviews = data.productReviews ?? [];
    if (pageReviews.length === 0) break;
    live.push(...pageReviews);
  }
  return live;
}

export async function getProductReviews(shop: string, productId: string) {
  const gid = toProductGid(productId);
  const trustpilot = effectiveTrustpilot(await getShopSettings(shop));
  const { admin } = await unauthenticated.admin(shop);
  const result = await adminGraphql<{
    data?: {
      product?: {
        handle?: string;
        metafields?: { edges?: Array<{ node?: { key?: string; value?: string } }> };
      } | null;
    };
    errors?: Array<{ message?: string }>;
  }>(admin, PRODUCT_QUERY, { id: gid });

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).filter(Boolean).join("; "));
  }
  const product = result.data?.product;
  if (!product) {
    return { notFound: true as const };
  }

  const edges = product.metafields?.edges;
  const stored = parseStoredReviews(metafieldValue(edges, "imported_reviews"));
  let productUrl = metafieldValue(edges, "old_url");
  if (!productUrl && product.handle) {
    productUrl = oldProductUrl(trustpilot.productHost, product.handle);
  }

  const live = await trustpilotReviews(
    productUrl,
    trustpilot.apiKey,
    trustpilot.businessUnitId,
    trustpilot.baseUrl,
  );
  return { notFound: false as const, ...mergeReviews(stored, live) };
}

export async function writeProductReview(
  shop: string,
  input: {
    productId: string;
    variantId: string;
    name: string;
    review: string;
    rating: unknown;
  },
) {
  const productId = toProductGid(input.productId);
  const variantId = toVariantGid(input.variantId);
  const { admin } = await unauthenticated.admin(shop);

  let variantName = "";
  if (variantId) {
    const variantResult = await adminGraphql<{
      data?: {
        productVariant?: {
          title?: string | null;
          selectedOptions?: Array<{ value?: string | null }>;
        } | null;
      };
    }>(admin, VARIANT_QUERY, { id: variantId });
    variantName = variantLabel(variantResult.data?.productVariant ?? null);
  }

  const existing = await adminGraphql<{
    data?: {
      product?: {
        tags?: string[];
        metafield?: { value?: string | null } | null;
      } | null;
    };
    errors?: Array<{ message?: string }>;
  }>(
    admin,
    `#graphql
      query ExistingReviews($id: ID!) {
        product(id: $id) {
          id
          tags
          metafield(namespace: "reviews", key: "imported_reviews") {
            value
          }
        }
      }
    `,
    { id: productId },
  );

  if (existing.errors?.length) {
    throw new Error(existing.errors.map((error) => error.message).filter(Boolean).join("; "));
  }
  if (!existing.data?.product) {
    return { notFound: true as const };
  }

  const reviews = parseStoredReviews(existing.data.product.metafield?.value);
  const next: InternalReview = {
    rSource: "internal",
    rItemType: "product",
    rItemID: oldIdFromTags(existing.data.product.tags ?? []),
    rPVCID: "0",
    rName: input.name,
    rLocation: "",
    rSubject: "",
    rContent: input.review,
    rURL: "",
    rExternalID: "",
    variant_name: variantName,
    rCreated: new Date().toISOString(),
  };
  if (input.rating !== "" && input.rating !== undefined && input.rating !== null) {
    next.rPoints = input.rating as number | string;
  }
  reviews.push(next);

  const saved = await adminGraphql<{
    data?: {
      metafieldsSet?: {
        userErrors?: Array<{ field?: string[] | null; message?: string; code?: string }>;
      };
    };
    errors?: Array<{ message?: string }>;
  }>(admin, METAFIELDS_SET, {
    metafields: [
      {
        ownerId: productId,
        namespace: "reviews",
        key: "imported_reviews",
        type: "json",
        value: JSON.stringify(reviews),
      },
    ],
  });

  const userErrors = saved.data?.metafieldsSet?.userErrors ?? [];
  if (saved.errors?.length || userErrors.length > 0) {
    return {
      notFound: false as const,
      failed: true as const,
      errors: userErrors.length > 0 ? userErrors : saved.errors,
    };
  }

  return {
    notFound: false as const,
    failed: false as const,
    product_id: productId,
    variant_id: variantId,
    variant_name: variantName,
    total_reviews: reviews.length,
  };
}
