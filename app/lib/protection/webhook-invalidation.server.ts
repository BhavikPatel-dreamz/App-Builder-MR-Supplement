import { authenticate } from "../../shopify.server";
import { invalidateStorefrontGraphqlCache } from "./cache-invalidation.server";

/**
 * Shared cache invalidation for Shopify product/collection webhooks.
 * Storefront GraphQL Redis keys only (no catalog read-model in this app yet).
 */
export async function handleCatalogWebhook(
  request: Request,
  topic: string,
): Promise<Response> {
  const { shop } = await authenticate.webhook(request);
  console.log(
    JSON.stringify({ event: "webhook", topic, shop, action: "cache_invalidate" }),
  );

  try {
    const storefrontCleared = await invalidateStorefrontGraphqlCache(shop);

    console.log(
      JSON.stringify({
        event: "webhook_invalidate",
        topic,
        shop,
        storefrontKeys: storefrontCleared,
      }),
    );
  } catch (err) {
    console.error(
      "[webhook] cache invalidation failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return new Response();
}
