/**
 * In-process interval warmer is for local `pnpm dev` only.
 * Production uses Vercel cron `/api/cron/cache-refresh` — do not start a
 * warmer from GET /graphql or GET /cms/* (that nested-warmed itself and
 * produced 30+ minute “ok” log rows).
 */

import { getOrCreateCacheConfig, warmAllEnabledUrls } from "./cache-store.server";

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

function isLocalIntervalEnabled(): boolean {
  if (process.env.VITEST) return false;
  if (process.env.GRAPHQL_WARM === "0") return false;
  if (process.env.VERCEL) return false;
  return true;
}

async function tick(): Promise<void> {
  const shop = process.env.SHOPIFY_STOREFRONT_DOMAIN;
  if (!shop) return;
  try {
    const config = await getOrCreateCacheConfig(shop);
    if (!config.warmerEnabled) return;
    await warmAllEnabledUrls(shop);
  } catch (err) {
    console.error(
      "[cache-warmer] tick failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export function ensureCacheWarmerStarted(): void {
  if (started || !isLocalIntervalEnabled()) return;
  started = true;
  const intervalMs = 5 * 60 * 1000;
  console.log("[cache-warmer] local interval every 300s (skipped on Vercel)");
  timer = setInterval(() => void tick(), intervalMs);
  if (timer && typeof timer.unref === "function") timer.unref();
}
