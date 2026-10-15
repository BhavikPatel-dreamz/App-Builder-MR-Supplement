import { authenticate } from "../../shopify.server";
import { listEnabledCacheUrlStrings } from "../cache-store.server";
import {
  purgeCatalogWebhookPayload,
  rewarmCatalogWebhookPayload,
  fillCloudflareCache,
} from "../catalog-warm.server";
import { getRedisClient } from "../redis-cache.server";
import { CATALOG_CDN_CACHE_TAG } from "../cache-policy.server";
import { getCdnProvider } from "./cdn-provider.server";
import { purgeIndiaEdge, warmIndiaEdge } from "../india-edge.server";

const WEBHOOK_STATUS_KEY = "webhook:last-status";

/** Persist a step breadcrumb so we can inspect webhook progress without
 * relying on Vercel log search (which is unreliable for this). */
async function writeWebhookStatus(step: string, extra: Record<string, unknown> = {}) {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.set(
      WEBHOOK_STATUS_KEY,
      JSON.stringify({ step, at: new Date().toISOString(), ...extra }),
      "EX",
      3600,
    );
  } catch {
    // best-effort only
  }
}

/** Read back the last webhook breadcrumb (used by /api/webhook-status). */
export async function readWebhookStatus(): Promise<unknown> {
  const redis = getRedisClient();
  if (!redis) return { error: "redis unavailable" };
  const raw = await redis.get(WEBHOOK_STATUS_KEY);
  return raw ? JSON.parse(raw) : { error: "no webhook recorded yet" };
}

/**
 * Targeted re-warm after product/collection webhooks.
 * Does not flush the whole shop Redis prefix (that would make first users MISS).
 */
export async function handleCatalogWebhook(
  request: Request,
  topic: string,
): Promise<Response> {
  const { shop, payload } = await authenticate.webhook(request);

  // Temporary pause until the production server deploy. HMAC is still verified
  // so Shopify stops retrying. Set WEBHOOKS_ENABLED=true to resume processing.
  if (process.env.WEBHOOKS_ENABLED !== "true") {
    console.log(
      JSON.stringify({
        event: "webhook",
        topic,
        shop,
        action: "skipped",
        reason: "WEBHOOKS_ENABLED is not true",
      }),
    );
    return new Response();
  }

  console.log(
    JSON.stringify({ event: "webhook", topic, shop, action: "cache_rewarm" }),
  );

  try {
    // Delete topics: the resource is gone in Shopify — purge cache entries
    // instead of re-fetching them.
    const isDelete = topic.endsWith("/delete");
    await writeWebhookStatus("start", { topic, shop, isDelete });
    const result = isDelete
      ? await purgeCatalogWebhookPayload(topic, payload)
      : await rewarmCatalogWebhookPayload(topic, payload);
    await writeWebhookStatus("rewarm_done", {
      topic,
      shop,
      urls: result.urls.length,
      warmed: "warmed" in result ? result.warmed : undefined,
      purged: "purged" in result ? result.purged : undefined,
    });
    const origin = (process.env.SHOPIFY_APP_URL ?? "").replace(/\/$/, "");
    const registered = await listEnabledCacheUrlStrings(shop);
    const extra = origin
      ? [`${origin}/cms/pages`, `${origin}/cms/settings`]
      : [];
    const paths = result.urls.map((path) =>
      path.startsWith("http") ? path : `${origin}${path}`,
    );
    const cfUrls = [...paths, ...extra];
    await getCdnProvider().purge({
      urls: [...cfUrls, ...registered],
      tags: [CATALOG_CDN_CACHE_TAG],
    });
    const cfFill = await fillCloudflareCache(isDelete ? [] : cfUrls);
    const indiaPurge = await purgeIndiaEdge(paths);
    const indiaWarm = await warmIndiaEdge(paths);
    await writeWebhookStatus("done", {
      topic,
      shop,
      urls: paths.length,
      cfFill,
      indiaPurge,
      indiaWarm,
      handler: "india-warm-force",
    });

    console.log(
      JSON.stringify({
        event: "webhook_invalidate",
        topic,
        shop,
        action: isDelete ? "purged" : "rewarmed",
        count:
          "purged" in result
            ? result.purged
            : (result as { warmed: number }).warmed,
        urls: result.urls.length,
      }),
    );
  } catch (err) {
    await writeWebhookStatus("error", {
      topic,
      message: err instanceof Error ? err.message : String(err),
    });
    console.error(
      "[webhook] cache invalidation failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return new Response();
}
