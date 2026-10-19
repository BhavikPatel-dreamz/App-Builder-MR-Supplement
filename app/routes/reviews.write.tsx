import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  readReviewFields,
  resolveReviewShop,
  reviewJson,
  reviewOptions,
  writeProductReview,
} from "../lib/reviews.server";

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return reviewOptions();
  if (request.method !== "POST") {
    return reviewJson({ success: false, message: "Use POST /reviews/write." }, 405);
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
    const saved = await writeProductReview(shop, {
      productId,
      variantId: String(fields.variant_id ?? ""),
      name: String(fields.name ?? ""),
      review: String(fields.review ?? ""),
      rating: fields.rating ?? "",
    });
    if (saved.notFound) {
      return reviewJson({ success: false, message: "Product not found.", data: null }, 404);
    }
    if (saved.failed) {
      return reviewJson(
        {
          success: false,
          message: "Failed to save review metafield.",
          errors: saved.errors,
          data: null,
        },
        400,
      );
    }
    return reviewJson({
      success: true,
      message: "Review imported successfully.",
      data: {
        product_id: saved.product_id,
        variant_id: saved.variant_id,
        variant_name: saved.variant_name,
        total_reviews: saved.total_reviews,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review request failed.";
    console.error("[reviews]", message);
    return reviewJson({ success: false, message }, 500);
  }
}

export const loader = ({ request }: LoaderFunctionArgs) => handle(request);
export const action = ({ request }: ActionFunctionArgs) => handle(request);
