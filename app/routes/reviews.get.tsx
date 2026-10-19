import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  getProductReviews,
  readReviewFields,
  resolveReviewShop,
  reviewJson,
  reviewOptions,
} from "../lib/reviews.server";

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return reviewOptions();
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD") {
    return reviewJson({ success: false, message: "Use GET /reviews/get." }, 405);
  }

  const shop = resolveReviewShop(request);
  if (!shop) {
    return reviewJson(
      {
        success: false,
        message: "Shop could not be resolved. Set OTA_SHOP or pass ?shop=store.myshopify.com.",
      },
      400,
    );
  }

  const fields = await readReviewFields(request);
  const productId = String(fields.product_id ?? "");
  if (!productId.trim()) {
    return reviewJson({ success: "false", message: "Product Id id are required." });
  }

  try {
    const result = await getProductReviews(shop, productId);
    if (result.notFound) {
      return reviewJson({ success: false, message: "Product not found.", reviews: [] }, 404);
    }
    return reviewJson({
      success: true,
      reviews_counts: result.reviews_counts,
      average_star: result.average_star,
      reviews: result.reviews,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review request failed.";
    console.error("[reviews]", message);
    return reviewJson({ success: false, message }, 500);
  }
}

export const loader = ({ request }: LoaderFunctionArgs) => handle(request);
export const action = ({ request }: ActionFunctionArgs) => handle(request);
