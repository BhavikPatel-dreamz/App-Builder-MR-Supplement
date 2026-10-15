/**
 * Runtime cache policy for public GET APIs (GraphQL + CMS).
 * Redis and Cloudflare/Vercel share the same 10–30 minute window.
 * Cron copies fresh JSON into Redis + edge so the first shopper is a HIT.
 */

export const MIN_CACHE_TTL_SECONDS = 600;
export const MAX_CACHE_TTL_SECONDS = 1800;
export const DEFAULT_CACHE_TTL_SECONDS = 1800;
export const DEFAULT_CACHE_SWR_SECONDS = 1800;
export const DEFAULT_CACHE_REFRESH_SECONDS = 300;

/** Collection query the native app already registered. */
export const DEFAULT_WARMER_SHA256 =
  "ca4f2ce38a7ba95a9128752116fe3972fbd5d0005e96baa82998887dbad7cc27";

export type CacheSettings = {
  redisEnabled: boolean;
  cdnEnabled: boolean;
  ttlSeconds: number;
  swrSeconds: number;
  warmerEnabled: boolean;
  warmerCollectionGids: string[];
  warmerSha256: string;
  warmerFirst: number;
};

export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  redisEnabled: true,
  cdnEnabled: true,
  ttlSeconds: DEFAULT_CACHE_TTL_SECONDS,
  swrSeconds: DEFAULT_CACHE_SWR_SECONDS,
  warmerEnabled: true,
  warmerCollectionGids: ["gid://shopify/Collection/375678697663"],
  warmerSha256: DEFAULT_WARMER_SHA256,
  warmerFirst: 10,
};

function clampTtl(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < MIN_CACHE_TTL_SECONDS) return fallback;
  return Math.min(Math.floor(parsed), MAX_CACHE_TTL_SECONDS);
}

function parseGids(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [...DEFAULT_CACHE_SETTINGS.warmerCollectionGids];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function parseCacheSettings(raw: unknown): CacheSettings {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const ttlSeconds = clampTtl(input.ttlSeconds, DEFAULT_CACHE_TTL_SECONDS);
  const swrSeconds = clampTtl(input.swrSeconds, ttlSeconds);

  return {
    redisEnabled: input.redisEnabled !== false,
    cdnEnabled: input.cdnEnabled !== false,
    ttlSeconds,
    swrSeconds,
    warmerEnabled: input.warmerEnabled !== false,
    warmerCollectionGids: parseGids(input.warmerCollectionGids),
    warmerSha256:
      typeof input.warmerSha256 === "string" && input.warmerSha256.trim().length === 64
        ? input.warmerSha256.trim().toLowerCase()
        : DEFAULT_WARMER_SHA256,
    warmerFirst: Math.min(Math.max(Number(input.warmerFirst) || 10, 1), 50),
  };
}

let runtime: CacheSettings | null = null;
let loadedAt = 0;
const POLICY_RELOAD_MS = 30_000;

export function applyRuntimeCachePolicy(settings: CacheSettings): void {
  runtime = settings;
  loadedAt = Date.now();
}

export function getRuntimeCachePolicy(): CacheSettings {
  if (runtime) return runtime;
  return { ...DEFAULT_CACHE_SETTINGS };
}

export function hasRuntimeCachePolicy(): boolean {
  return runtime !== null;
}

export function envCacheTtl(): number | null {
  const parsed = Number(process.env.SHOPIFY_GRAPHQL_CACHE_TTL);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function envCacheSwr(): number | null {
  const parsed = Number(process.env.SHOPIFY_GRAPHQL_CACHE_SWR);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Load shop cache settings into memory (at most every 30s). Failure is ignored.
 */
export async function ensureRuntimeCachePolicy(shop?: string | null): Promise<void> {
  if (runtime && Date.now() - loadedAt < POLICY_RELOAD_MS) return;
  const domain = (shop || process.env.SHOPIFY_STOREFRONT_DOMAIN || "").trim();
  if (!domain) {
    if (!runtime) applyRuntimeCachePolicy({ ...DEFAULT_CACHE_SETTINGS });
    return;
  }
  try {
    const { getOrCreateCacheConfig, policyFromStoreConfig } = await import(
      "./cache-store.server"
    );
    const config = await getOrCreateCacheConfig(domain);
    applyRuntimeCachePolicy(policyFromStoreConfig(config));
  } catch (err) {
    console.error(
      "[cache-policy] failed to load cache tables, using defaults:",
      err instanceof Error ? err.message : err,
    );
    if (!runtime) applyRuntimeCachePolicy({ ...DEFAULT_CACHE_SETTINGS });
  }
}

export function publicCacheControlValue(): string {
  const policy = getRuntimeCachePolicy();
  if (!policy.cdnEnabled) return "no-store";
  const ttl = policy.ttlSeconds;
  const swr = Math.max(policy.swrSeconds, ttl);
  // Keep max-age = s-maxage. Changing max-age on deploy busts Vercel edge objects.
  return `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${swr}`;
}

export function cdnCacheControlValue(): string | null {
  const policy = getRuntimeCachePolicy();
  if (!policy.cdnEnabled) return null;
  const ttl = policy.ttlSeconds;
  const swr = Math.max(policy.swrSeconds, ttl);
  return `public, max-age=${ttl}, stale-while-revalidate=${swr}`;
}

/** Vercel reads this more reliably than s-maxage on Cache-Control. */
export const CATALOG_CDN_CACHE_TAG = "catalog";

export function applyCdnCacheHeaders(headers: Record<string, string>): void {
  const cdn = cdnCacheControlValue();
  if (!cdn) return;
  headers["CDN-Cache-Control"] = cdn;
  headers["Vercel-CDN-Cache-Control"] = cdn;
  headers["Cloudflare-CDN-Cache-Control"] = cdn;
  headers["Cache-Tag"] = CATALOG_CDN_CACHE_TAG;
}
