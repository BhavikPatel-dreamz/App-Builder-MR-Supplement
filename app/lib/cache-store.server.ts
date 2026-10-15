import db from "../db.server";
import {
  applyRuntimeCachePolicy,
  DEFAULT_CACHE_REFRESH_SECONDS,
  DEFAULT_WARMER_SHA256,
  MAX_CACHE_TTL_SECONDS,
  MIN_CACHE_TTL_SECONDS,
  parseCacheSettings,
  type CacheSettings,
} from "./cache-policy.server";
import { allPersistedQueries, PERSISTED_QUERY_HASH_ALIASES } from "./persisted-queries";
import { ALL_STOREFRONT_PQ_HASHES, STOREFRONT_PQ, collectionByHandleVariables, collectionByIdVariables } from "./storefront-query-hashes";
import {
  catalogWarmLimits,
  rewarmCatalogWebhookPayload,
  touchCatalogAccess,
} from "./catalog-warm.server";
import {
  buildCacheKey,
  cacheDel,
  canonicalGraphqlGetPath,
  canonicalizeGraphqlVariables,
  getCacheTTL,
  getPersistedQuery,
  getRedisClient,
  setPersistedQuery,
  withCache,
} from "./redis-cache.server";
import { executeStorefrontRequest } from "./shopify-storefront.server";
import {
  cmsPageSlugCacheKey,
  cmsPagesListCacheKey,
  cmsSettingsCacheKey,
  invalidateCmsPublicCache,
  invalidateCmsSettingsCache,
  normalizeShopDomain,
} from "./cms-public-cache.server";
import { tryAcquireCacheLock, releaseCacheLock } from "./protection/distributed-lock.server";
import { invalidateStorefrontGraphqlCache } from "./protection/cache-invalidation.server";
import { getCdnProvider } from "./protection/cdn-provider.server";
import { getPublishedPageBySlug, listPublishedPages } from "./cms.server";
import { getShopSettings, toPublicShopSettings } from "./settings.server";

const DEFAULT_COLLECTION_GID = "gid://shopify/Collection/375678697663";

/** Curl/docs example — different hash, collection, and `first` than the app PLP query. */
export const DOCS_COLLECTION_SHA256 =
  "6fa67e8cb153fec67b0fbab3bb9ccc3704997da5287f7ee9faa0a55006bd845d";
const DOCS_COLLECTION_GID = "gid://shopify/Collection/352562380953";

export function policyFromStoreConfig(row: {
  redisEnabled: boolean;
  cdnEnabled: boolean;
  ttlSeconds: number;
  swrSeconds: number;
  warmerEnabled: boolean;
}): CacheSettings {
  return parseCacheSettings({
    redisEnabled: row.redisEnabled,
    cdnEnabled: row.cdnEnabled,
    ttlSeconds: row.ttlSeconds,
    swrSeconds: row.swrSeconds,
    warmerEnabled: row.warmerEnabled,
  });
}

export function parseCacheUrlInput(rawUrl: string): {
  url: string;
  sha256: string;
  variablesJson: string;
  slug: string;
  kind: string;
} {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed, "https://appbuilder.dreamzapps.com");
  } catch {
    parsed = new URL("https://appbuilder.dreamzapps.com/");
  }
  const sha256 = parsed.searchParams.get("sha256")?.trim() ?? "";
  const variablesRaw = parsed.searchParams.get("variables") ?? "{}";
  let variablesJson = "{}";
  try {
    const parsedVars = JSON.parse(variablesRaw) as Record<string, unknown>;
    variablesJson = JSON.stringify(canonicalizeGraphqlVariables(parsedVars));
  } catch {
    variablesJson = "{}";
  }
  const slugMatch = parsed.pathname.match(/\/cms\/pages\/([^/]+)/);
  const slug = slugMatch ? decodeURIComponent(slugMatch[1]) : "";
  const pathAndQuery = `${parsed.pathname}${parsed.search}`;
  let kind = "custom";
  if (sha256 || parsed.pathname.includes("/graphql")) kind = "graphql";
  else if (/\/cms\/settings\/?$/.test(parsed.pathname)) kind = "cms_settings";
  else if (/\/cms\/pages\/?$/.test(parsed.pathname)) kind = "cms_pages";
  else if (slug) kind = "cms_slug";
  return { url: pathAndQuery, sha256, variablesJson, slug, kind };
}

export function uniqueCacheUrlKey(row: {
  kind: string;
  sha256: string;
  variablesJson: string;
  url: string;
}): string {
  if (row.kind === "graphql" || row.sha256) {
    return `graphql:${row.sha256}:${row.variablesJson}`;
  }
  return `${row.kind}:${row.url.split("?")[0]}`;
}

function graphqlCacheRow(
  shop: string,
  configId: string,
  label: string,
  sha256: string,
  variables: Record<string, unknown>,
) {
  const variablesJson = JSON.stringify(canonicalizeGraphqlVariables(variables));
  return {
    shop,
    configId,
    label,
    url: `/graphql?sha256=${sha256}&variables=${encodeURIComponent(variablesJson)}`,
    kind: "graphql" as const,
    sha256,
    variablesJson,
    queryText: "",
  };
}

function standardCacheUrlRows(shop: string, configId: string) {
  return [
    {
      shop,
      configId,
      label: "CMS pages list",
      url: "/cms/pages",
      kind: "cms_pages",
      sha256: "",
      variablesJson: "{}",
      slug: "",
      queryText: "",
    },
    {
      shop,
      configId,
      label: "CMS settings",
      url: "/cms/settings",
      kind: "cms_settings",
      sha256: "",
      variablesJson: "{}",
      slug: "",
      queryText: "",
    },
    graphqlCacheRow(
      shop,
      configId,
      "Products by collection ID (first:10)",
      DEFAULT_WARMER_SHA256,
      collectionByIdVariables(DEFAULT_COLLECTION_GID, 10),
    ),
    graphqlCacheRow(
      shop,
      configId,
      "Products by collection ID (docs first:2)",
      DOCS_COLLECTION_SHA256,
      { id: DOCS_COLLECTION_GID, first: 2 },
    ),
  ];
}

async function seedDefaultUrls(shop: string, configId: string): Promise<void> {
  await db.cacheUrl.createMany({ data: standardCacheUrlRows(shop, configId) });
}

async function ensureStandardCacheUrls(
  shop: string,
  configId: string,
  existing: Array<{ sha256: string; variablesJson: string; url: string }>,
): Promise<boolean> {
  const missing = standardCacheUrlRows(shop, configId).filter((row) => {
    if (row.kind === "graphql") {
      return !existing.some(
        (item) => item.sha256 === row.sha256 && item.variablesJson === row.variablesJson,
      );
    }
    return !existing.some((item) => item.url.split("?")[0] === row.url);
  });
  if (missing.length === 0) return false;
  await db.cacheUrl.createMany({ data: missing });
  return true;
}

export async function getOrCreateCacheConfig(shop: string) {
  const normalised = normalizeShopDomain(shop);
  let config = await db.cacheStoreConfig.findUnique({
    where: { shop: normalised },
    include: { urls: { orderBy: { createdAt: "asc" } } },
  });
  if (!config) {
    config = await db.cacheStoreConfig.create({
      data: { shop: normalised },
      include: { urls: true },
    });
    await seedDefaultUrls(normalised, config.id);
    config = await db.cacheStoreConfig.findUniqueOrThrow({
      where: { shop: normalised },
      include: { urls: { orderBy: { createdAt: "asc" } } },
    });
  } else {
    const added = await ensureStandardCacheUrls(normalised, config.id, config.urls);
    if (added) {
      config = await db.cacheStoreConfig.findUniqueOrThrow({
        where: { shop: normalised },
        include: { urls: { orderBy: { createdAt: "asc" } } },
      });
    }
  }
  applyRuntimeCachePolicy(policyFromStoreConfig(config));
  return config;
}

export async function listCacheLogs(shop: string, take = 40) {
  return db.cacheLog.findMany({
    where: { shop: normalizeShopDomain(shop) },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function updateCacheConfig(
  shop: string,
  input: {
    redisEnabled: boolean;
    cdnEnabled: boolean;
    ttlSeconds: number;
    swrSeconds: number;
    warmerEnabled: boolean;
    refreshIntervalSeconds: number;
  },
) {
  const config = await getOrCreateCacheConfig(shop);
  const ttl = Math.min(
    Math.max(input.ttlSeconds, MIN_CACHE_TTL_SECONDS),
    MAX_CACHE_TTL_SECONDS,
  );
  const swr = Math.min(
    Math.max(input.swrSeconds, MIN_CACHE_TTL_SECONDS),
    MAX_CACHE_TTL_SECONDS,
  );
  const refresh = DEFAULT_CACHE_REFRESH_SECONDS;
  const updated = await db.cacheStoreConfig.update({
    where: { id: config.id },
    data: {
      redisEnabled: input.redisEnabled,
      cdnEnabled: input.cdnEnabled,
      ttlSeconds: ttl,
      swrSeconds: swr,
      warmerEnabled: input.warmerEnabled,
      refreshIntervalSeconds: refresh,
    },
    include: { urls: { orderBy: { createdAt: "asc" } } },
  });
  applyRuntimeCachePolicy(policyFromStoreConfig(updated));
  await writeLog(updated.shop, updated.id, {
    action: "save_config",
    message: `ttl=${ttl}s refresh=${refresh}s`,
  });
  return updated;
}

export async function rememberPersistedQueryText(sha256: string, query: string): Promise<void> {
  const text = query.trim();
  const hash = sha256.trim();
  if (!hash || !text) return;
  try {
    await db.cacheUrl.updateMany({
      where: { sha256: hash, queryText: "" },
      data: { queryText: text },
    });
  } catch (err) {
    console.error(
      "[cache-store] remember query text failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function lookupPersistedQueryText(sha256: string): Promise<string | null> {
  const hash = sha256.trim();
  if (!hash) return null;
  const catalog = allPersistedQueries().find((entry) => entry.sha256 === hash);
  if (catalog) return catalog.query;
  try {
    const row = await db.cacheUrl.findFirst({
      where: { sha256: hash, NOT: { queryText: "" } },
      select: { queryText: true },
    });
    return row?.queryText?.trim() || null;
  } catch (err) {
    console.error(
      "[cache-store] lookup query text failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function registerCatalogPersistedDocuments(): Promise<number> {
  let n = 0;
  for (const entry of allPersistedQueries()) {
    await setPersistedQuery(entry.query, entry.sha256);
    n += 1;
    for (const alias of PERSISTED_QUERY_HASH_ALIASES[entry.sha256] ?? []) {
      await setPersistedQuery(entry.query, alias);
      n += 1;
    }
  }
  return n;
}

let catalogPqOnce: Promise<number> | null = null;

/** First GraphQL request after a deploy writes catalog hashes into Redis (no CLI). */
export function ensureCatalogPersistedQueries(): Promise<number> {
  if (!catalogPqOnce) {
    catalogPqOnce = (async () => {
      let n = 0;
      n += await registerCatalogPersistedDocuments();
      return n;
    })().catch((err) => {
      catalogPqOnce = null;
      console.error(
        "[cache-store] catalog PQ ensure failed:",
        err instanceof Error ? err.message : err,
      );
      return 0;
    });
  }
  return catalogPqOnce;
}

/** Re-register APQ hashes in Redis so GET ?sha256= never returns PersistedQueryNotFound. */
export async function registerKnownPersistedQueries(): Promise<number> {
  let registered = 0;
  registered += await registerCatalogPersistedDocuments();
  try {
    const rows = await db.cacheUrl.findMany({
      where: { kind: "graphql", NOT: { queryText: "" } },
      select: { queryText: true, sha256: true },
    });
    for (const row of rows) {
      await setPersistedQuery(row.queryText, row.sha256);
      registered += 1;
    }
    for (const hash of ALL_STOREFRONT_PQ_HASHES) {
      const text = await lookupPersistedQueryText(hash);
      if (text) {
        await setPersistedQuery(text, hash);
        registered += 1;
      }
    }
  } catch (err) {
    console.error(
      "[cache-store] register known queries failed:",
      err instanceof Error ? err.message : err,
    );
  }
  return registered;
}

async function resolveGraphqlQuery(row: {
  sha256: string;
  queryText?: string;
}): Promise<string | null> {
  const pasted = row.queryText?.trim();
  if (pasted) {
      await setPersistedQuery(pasted, row.sha256);
    return pasted;
  }
  const known = await lookupPersistedQueryText(row.sha256);
  if (known) {
    await setPersistedQuery(known, row.sha256);
    return known;
  }
  return row.sha256 ? getPersistedQuery(row.sha256) : null;
}

export async function createCacheUrl(
  shop: string,
  label: string,
  rawUrl: string,
  queryText = "",
) {
  const config = await getOrCreateCacheConfig(shop);
  const parsed = parseCacheUrlInput(rawUrl);
  const trimmedQuery = queryText.trim();
  if (trimmedQuery) {
    await setPersistedQuery(trimmedQuery);
  }
  const row = await db.cacheUrl.create({
    data: {
      shop: config.shop,
      configId: config.id,
      label: label.trim() || parsed.kind,
      ...parsed,
      queryText: trimmedQuery,
    },
  });
  await writeLog(config.shop, config.id, {
    action: "create_url",
    urlId: row.id,
    message: row.url,
  });
  return row;
}

export async function listEnabledCacheUrlStrings(
  shop: string,
  take = 500,
): Promise<string[]> {
  const rows = await db.cacheUrl.findMany({
    where: { shop: shop.toLowerCase().trim(), enabled: true },
    select: { url: true },
    take,
  });
  return rows.map((row) => row.url);
}

export async function deleteCacheUrl(shop: string, id: string) {
  const config = await getOrCreateCacheConfig(shop);
  await db.cacheUrl.deleteMany({ where: { id, shop: config.shop } });
  await writeLog(config.shop, config.id, {
    action: "delete_url",
    urlId: id,
    message: id,
  });
}

async function writeLog(
  shop: string,
  configId: string,
  entry: {
    action: string;
    urlId?: string;
    status?: string;
    durationMs?: number;
    message?: string;
  },
) {
  try {
    await db.cacheLog.create({
      data: {
        shop,
        configId,
        urlId: entry.urlId,
        action: entry.action,
        status: entry.status ?? "ok",
        durationMs: entry.durationMs ?? 0,
        message: (entry.message ?? "").slice(0, 500),
      },
    });
  } catch (err) {
    console.error("[cache-store] log write failed:", err instanceof Error ? err.message : err);
  }
}

function statKey(id: string, kind: "hit" | "miss") {
  return `cacheurl:stat:${id}:${kind}`;
}

export function urlMatchesRequest(
  requestUrl: URL,
  row: { url: string; kind: string; sha256: string; variablesJson: string; slug: string },
): boolean {
  const parsed = parseCacheUrlInput(row.url);
  const rowPath = parsed.url.split("?")[0];
  if (requestUrl.pathname !== rowPath) return false;
  if (row.kind === "graphql" || parsed.kind === "graphql") {
    const sha = requestUrl.searchParams.get("sha256") || "";
    if (row.sha256 && sha !== row.sha256) return false;
    const vars = requestUrl.searchParams.get("variables");
    if (row.variablesJson && vars) {
      try {
        const incoming = JSON.stringify(
          canonicalizeGraphqlVariables(JSON.parse(vars) as Record<string, unknown>),
        );
        const stored = JSON.stringify(
          canonicalizeGraphqlVariables(JSON.parse(row.variablesJson) as Record<string, unknown>),
        );
        if (incoming !== stored) return false;
      } catch {
        return false;
      }
    }
    return true;
  }
  if (row.kind === "cms_slug") {
    const slug = requestUrl.pathname.split("/").filter(Boolean).pop() || "";
    return slug === (row.slug || parsed.slug);
  }
  return true;
}

export async function recordPublicCacheAccess(
  request: Request,
  cacheStatus: string,
): Promise<void> {
  try {
    if (request.headers.get("x-cache-warm") === "1") return;
    if (cacheStatus === "REFRESH" || cacheStatus === "BYPASS") return;
    const redis = getRedisClient();
    if (!redis) return;

    const reqUrl = new URL(request.url);
    const parsed = parseCacheUrlInput(`${reqUrl.pathname}${reqUrl.search}`);
    const isHit = cacheStatus === "HIT" || cacheStatus === "STALE";
    if (parsed.sha256) {
      let variables: Record<string, unknown> = {};
      try {
        variables = JSON.parse(parsed.variablesJson || "{}") as Record<string, unknown>;
      } catch {
        variables = {};
      }
      await touchCatalogAccess(parsed.sha256, variables);
    }
    const key = `cacheurl:stat:${uniqueCacheUrlKey(parsed)}:${isHit ? "hit" : "miss"}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60 * 24 * 30);
  } catch (err) {
    console.error("[cache-store] access record failed:", err instanceof Error ? err.message : err);
  }
}

export async function mergeUrlCounts<
  T extends { id: string; hitCount: number; missCount: number },
>(urls: T[]): Promise<Array<T & { liveHits: number; liveMisses: number }>> {
  const redis = getRedisClient();
  return Promise.all(
    urls.map(async (url) => {
      let extraHits = 0;
      let extraMisses = 0;
      if (redis) {
      extraHits = Number((await redis.get(statKey(url.id, "hit"))) || 0);
        extraHits += Number(
          (await redis.get(`cacheurl:stat:${uniqueCacheUrlKey(url)}:hit`)) || 0,
        );
        extraMisses = Number((await redis.get(statKey(url.id, "miss"))) || 0);
        extraMisses += Number(
          (await redis.get(`cacheurl:stat:${uniqueCacheUrlKey(url)}:miss`)) || 0,
        );
      }
      return {
        ...url,
        liveHits: url.hitCount + extraHits,
        liveMisses: url.missCount + extraMisses,
      };
    }),
  );
}

export async function clearOneCacheUrl(shop: string, id: string) {
  const config = await getOrCreateCacheConfig(shop);
  const row = config.urls.find((item) => item.id === id);
  if (!row) throw new Error("Cache URL not found.");
  const started = Date.now();
  const domain = process.env.SHOPIFY_STOREFRONT_DOMAIN || config.shop;

  if (row.kind === "cms_pages") {
    await cacheDel(cmsPagesListCacheKey(config.shop));
  } else if (row.kind === "cms_settings") {
    await cacheDel(cmsSettingsCacheKey(config.shop));
  } else if (row.kind === "cms_slug") {
    const slug = row.slug || parseCacheUrlInput(row.url).slug;
    await cacheDel(cmsPageSlugCacheKey(config.shop, slug));
  } else if (row.kind === "graphql") {
    const query = await resolveGraphqlQuery(row);
    if (query) {
      let variables: Record<string, unknown> = {};
      try {
        variables = JSON.parse(row.variablesJson || "{}") as Record<string, unknown>;
      } catch {
        variables = {};
      }
      await cacheDel(buildCacheKey(`storefront:${domain}`, query, variables));
    }
  }

  await db.cacheUrl.update({
    where: { id: row.id },
    data: { lastClearedAt: new Date() },
  });
  const durationMs = Date.now() - started;
  await writeLog(config.shop, config.id, {
    action: "clear",
    urlId: row.id,
    durationMs,
    message: row.label,
  });
  return { ok: true, label: row.label, durationMs };
}

async function flushIndiaCatalogCache(): Promise<{ skipped: boolean; cleared?: number }> {
  const base = (process.env.CATALOG_CACHE_FLUSH_URL || "").replace(/\/$/, "");
  const secret = process.env.CACHE_CRON_SECRET || "";
  if (!base || !secret) return { skipped: true };
  try {
    const res = await fetch(`${base}/flush`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await res.json().catch(() => ({}))) as { cleared?: number };
    return { skipped: !res.ok, cleared: body.cleared };
  } catch {
    return { skipped: true };
  }
}

/** Redis GraphQL+CMS, CDN URL purge, India 8088 flush. Not a global Redis FLUSHALL. */
export async function clearAllPublicCache(shop: string) {
  const config = await getOrCreateCacheConfig(shop);
  const started = Date.now();
  const storefrontDomain = (
    process.env.SHOPIFY_STOREFRONT_DOMAIN || config.shop
  ).toLowerCase();

  const graphqlKeys = await invalidateStorefrontGraphqlCache(storefrontDomain);
  let graphqlKeysAlias = 0;
  if (normalizeShopDomain(config.shop) !== storefrontDomain) {
    graphqlKeysAlias = await invalidateStorefrontGraphqlCache(config.shop);
  }
  const cmsPages = await invalidateCmsPublicCache(config.shop);
  const cmsSettings = await invalidateCmsSettingsCache(config.shop);

  const origin = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  const extra = origin
    ? [`${origin}/cms/pages`, `${origin}/cms/settings`]
    : [];
  const registered = await listEnabledCacheUrlStrings(config.shop);
  await getCdnProvider().purge({ urls: [...registered, ...extra] });

  const india = await flushIndiaCatalogCache();
  const durationMs = Date.now() - started;
  await writeLog(config.shop, config.id, {
    action: "clear_all",
    durationMs,
    message: `graphql=${graphqlKeys + graphqlKeysAlias} cmsPages=${cmsPages} cmsSettings=${cmsSettings} india=${india.skipped ? "skipped" : india.cleared ?? 0}`,
  });
  return {
    ok: true,
    durationMs,
    graphqlKeys: graphqlKeys + graphqlKeysAlias,
    cmsPages,
    india: india.skipped ? "skipped" : `cleared ${india.cleared ?? 0}`,
  };
}

// ---------------------------------------------------------------------------
// Scoped manual clear (admin UI): one product, one collection, or one URL —
// never a shop-wide SCAN-del.
// ---------------------------------------------------------------------------

/** Per-URL purge on the India/VPS edge (catalog-cache.mjs /purge). Env-guarded. */
async function purgeIndiaEdgeUrls(urls: string[]): Promise<string> {
  const host = (process.env.CACHE_INDIA_PURGE_HOST || "").replace(/\/$/, "");
  const secret = process.env.CACHE_CRON_SECRET || "";
  if (!host || !secret || urls.length === 0) return "skipped";
  try {
    const res = await fetch(`${host}/purge`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": secret },
      body: JSON.stringify({ urls }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok ? "ok" : `http ${res.status}`;
  } catch {
    return "error";
  }
}

/** Probe a public URL and report its X-Cache header (before/after status). */
async function probePublicCacheStatus(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    await res.arrayBuffer();
    return res.headers.get("x-cache") || `http ${res.status}`;
  } catch {
    return "unreachable";
  }
}

export type ScopedCacheTarget =
  | { kind: "product"; id?: string; handle?: string }
  | { kind: "collection"; id?: string; handle?: string }
  | { kind: "url"; url: string };

/**
 * Clear (and optionally re-warm) a single product, collection, or raw URL.
 * Deletes only the matching Redis/L1 keys, purges those URLs at Cloudflare and
 * the India VPS edge, and logs to cacheLog (visible in the Logs tab).
 */
export async function clearPublicCacheForKey(
  shop: string,
  target: ScopedCacheTarget,
  opts: { rewarm?: boolean } = {},
): Promise<{ ok: true; durationMs: number; message: string }> {
  const config = await getOrCreateCacheConfig(shop);
  const started = Date.now();
  const domain = (
    process.env.SHOPIFY_STOREFRONT_DOMAIN || config.shop
  ).toLowerCase();
  const origin = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  const clearedKeys: string[] = [];
  const paths: string[] = [];
  let rewarmed = 0;

  // Build the URL list first so we can probe the pre-clear cache status.
  if (target.kind === "product" || target.kind === "collection") {
    const isProduct = target.kind === "product";
    const first = catalogWarmLimits().collectionFirst;
    if (isProduct) {
      if (target.id) {
        paths.push(canonicalGraphqlGetPath(STOREFRONT_PQ.productById, { id: target.id }));
      }
      if (target.handle) {
        paths.push(
          canonicalGraphqlGetPath(STOREFRONT_PQ.productByHandle, { handle: target.handle }),
        );
      }
    } else {
      if (target.id) {
        paths.push(
          canonicalGraphqlGetPath(
            STOREFRONT_PQ.productsByCollectionId,
            collectionByIdVariables(target.id, first),
          ),
        );
      }
      if (target.handle) {
        paths.push(
          canonicalGraphqlGetPath(
            STOREFRONT_PQ.productsByCollectionHandle,
            collectionByHandleVariables(target.handle, first),
          ),
        );
      }
    }
  } else {
    paths.push(parseCacheUrlInput(target.url).url);
  }
  const fullUrls = paths
    .map((u) => (u.startsWith("http") ? u : `${origin}${u}`))
    .filter((u) => u.startsWith("http"));
  const before = fullUrls[0] ? await probePublicCacheStatus(fullUrls[0]) : "n/a";

  if (target.kind === "product" || target.kind === "collection") {
    const isProduct = target.kind === "product";
    const first = catalogWarmLimits().collectionFirst;
    const specs: Array<{ sha256: string; variables: Record<string, unknown> }> = [];
    if (isProduct) {
      if (target.id) {
        specs.push({ sha256: STOREFRONT_PQ.productById, variables: { id: target.id } });
      }
      if (target.handle) {
        specs.push({
          sha256: STOREFRONT_PQ.productByHandle,
          variables: { handle: target.handle },
        });
      }
    } else {
      if (target.id) {
        specs.push({
          sha256: STOREFRONT_PQ.productsByCollectionId,
          variables: collectionByIdVariables(target.id, first),
        });
      }
      if (target.handle) {
        specs.push({
          sha256: STOREFRONT_PQ.productsByCollectionHandle,
          variables: collectionByHandleVariables(target.handle, first),
        });
      }
    }

    for (const spec of specs) {
      const query = await resolveGraphqlQuery({ sha256: spec.sha256 });
      if (!query) continue;
      const key = buildCacheKey(`storefront:${domain}`, query, spec.variables);
      await cacheDel(key);
      clearedKeys.push(key);
    }

    if (opts.rewarm) {
      const result = await rewarmCatalogWebhookPayload(
        isProduct ? "products/update" : "collections/update",
        { admin_graphql_api_id: target.id, handle: target.handle },
      );
      rewarmed = result.warmed;
    }
  } else {
    const parsed = parseCacheUrlInput(target.url);
    if (parsed.kind === "cms_pages") {
      await cacheDel(cmsPagesListCacheKey(config.shop));
      clearedKeys.push("cms:pages");
    } else if (parsed.kind === "cms_settings") {
      await cacheDel(cmsSettingsCacheKey(config.shop));
      clearedKeys.push("cms:settings");
    } else if (parsed.kind === "cms_slug") {
      await cacheDel(cmsPageSlugCacheKey(config.shop, parsed.slug));
      clearedKeys.push(`cms:slug:${parsed.slug}`);
    } else if (parsed.kind === "graphql") {
      const query = await resolveGraphqlQuery({ sha256: parsed.sha256 });
      if (query) {
        let variables: Record<string, unknown> = {};
        try {
          variables = JSON.parse(parsed.variablesJson || "{}") as Record<string, unknown>;
        } catch {
          variables = {};
        }
        const key = buildCacheKey(`storefront:${domain}`, query, variables);
        await cacheDel(key);
        clearedKeys.push(key);
      }
    }

    if (opts.rewarm && origin) {
      try {
        const res = await fetch(`${origin}${parsed.url}`, {
          headers: { Accept: "application/json", "X-Cache-Warm": "1" },
          signal: AbortSignal.timeout(10_000),
        });
        await res.arrayBuffer();
        rewarmed = res.ok ? 1 : 0;
      } catch {
        rewarmed = 0;
      }
    }
  }

  await getCdnProvider().purge({ urls: fullUrls });
  const india = await purgeIndiaEdgeUrls(fullUrls);
  const after =
    opts.rewarm && fullUrls[0] ? await probePublicCacheStatus(fullUrls[0]) : "cleared";

  const durationMs = Date.now() - started;
  const label =
    target.kind === "url" ? target.url : `${target.kind} ${target.id || target.handle}`;
  await writeLog(config.shop, config.id, {
    action: `clear_${target.kind}`,
    durationMs,
    message: `${label} keys=${clearedKeys.length} rewarm=${opts.rewarm ? rewarmed : "off"} india=${india} before=${before} after=${after}`,
  });
  return {
    ok: true,
    durationMs,
    message: `Cleared ${label}: ${clearedKeys.length} key(s), CDN purged, India=${india}${
      opts.rewarm ? `, re-warmed ${rewarmed}` : ""
    }. Status before=${before} after=${after}. ${durationMs}ms.`,
  };
}

async function warmRow(
  shop: string,
  row: {
    kind: string;
    sha256: string;
    variablesJson: string;
    slug: string;
    url: string;
    queryText?: string;
  },
) {
  if (row.kind === "cms_pages") {
    await withCache(cmsPagesListCacheKey(shop), "refresh", async () => {
      const pages = await listPublishedPages(shop);
      return { success: true as const, pages };
    });
    return;
  }
  if (row.kind === "cms_settings") {
    await withCache(cmsSettingsCacheKey(shop), "refresh", async () => {
      const settings = await getShopSettings(shop);
      const publicSettings = toPublicShopSettings(settings);
      return {
        success: true as const,
        bottomTab: publicSettings.bottomTab,
        homePage: publicSettings.homePage,
        cart: publicSettings.cart,
        search: publicSettings.search,
        productDetails: publicSettings.productDetails,
        appstle: publicSettings.appstle,
        trustpilot: publicSettings.trustpilot,
        reviews: publicSettings.reviews,
        settings: publicSettings,
        todaysMeditation: publicSettings.todaysMeditation,
        todaysAffirmation: publicSettings.todaysAffirmation,
        cacheTtlSeconds: getCacheTTL(),
      };
    });
    return;
  }
  if (row.kind === "cms_slug") {
    const slug = row.slug || parseCacheUrlInput(row.url).slug;
    await withCache(cmsPageSlugCacheKey(shop, slug), "refresh", () =>
      getPublishedPageBySlug(shop, slug),
      { shouldCache: (page) => page !== null },
    );
    return;
  }
  if (row.kind === "graphql" && row.sha256) {
    const query = await resolveGraphqlQuery(row);
    if (!query) return;
    let variables: Record<string, unknown> = {};
    try {
      variables = JSON.parse(row.variablesJson || "{}") as Record<string, unknown>;
    } catch {
      variables = {};
    }
    await executeStorefrontRequest(query, variables, "refresh");
  }
}

async function fillEdgeCache(pathAndQuery: string): Promise<void> {
  if (process.env.VITEST) return;
  const origin = (
    process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com"
  ).replace(/\/$/, "");
  let path = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${origin}${pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`}`;
  if (path.startsWith(origin) && !/[?&]cache=/.test(path)) {
    path = path.includes("?") ? `${path}&cache=refresh` : `${path}?cache=refresh`;
  }
  try {
    const res = await fetch(path, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Cache-Warm": "1",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    await res.arrayBuffer();
  } catch (err) {
    console.error(
      "[cache-store] edge fill failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function warmOneCacheUrl(shop: string, id: string) {
  const config = await getOrCreateCacheConfig(shop);
  const row = config.urls.find((item) => item.id === id);
  if (!row) throw new Error("Cache URL not found.");
  const started = Date.now();
  await warmRow(config.shop, row);
  await fillEdgeCache(row.url);
  if (row.kind === "graphql" && row.sha256) {
    let variables: Record<string, unknown> = {};
    try {
      variables = JSON.parse(row.variablesJson || "{}") as Record<string, unknown>;
    } catch {
      variables = {};
    }
    if (variables.after === undefined) {
      const withAfter = {
        ...variables,
        after: null,
      };
      const alias = `/graphql?sha256=${row.sha256}&variables=${encodeURIComponent(JSON.stringify(withAfter))}`;
      if (alias !== row.url) await fillEdgeCache(alias);
    }
  }
  const durationMs = Date.now() - started;
  await db.cacheUrl.update({
    where: { id: row.id },
    data: { lastWarmedAt: new Date() },
  });
  await writeLog(config.shop, config.id, {
    action: "warm",
    urlId: row.id,
    durationMs,
    message: row.label,
  });
  return { ok: true, label: row.label, durationMs };
}

let inProcessWarmShop = "";

export async function warmAllEnabledUrls(shop: string) {
  if (inProcessWarmShop) {
    return { warmed: 0, skipped: true };
  }
  inProcessWarmShop = shop;
  try {
    return await runWarmAllEnabledUrls(shop);
  } finally {
    inProcessWarmShop = "";
  }
}

async function runWarmAllEnabledUrls(shop: string) {
  const config = await getOrCreateCacheConfig(shop);
  if (!config.warmerEnabled) return { warmed: 0, skipped: false };

  const lock = await tryAcquireCacheLock(`warm-all:${config.shop}`, 180);
  if (lock && !lock.acquired) {
    await writeLog(config.shop, config.id, {
      action: "warm",
      status: "skipped",
      message: "Already warming — skipped overlapping cron",
    });
    return { warmed: 0, skipped: true };
  }

  const seen = new Set<string>();
  let warmed = 0;
  try {
    for (const row of config.urls.filter((item) => item.enabled)) {
      const key = uniqueCacheUrlKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await warmOneCacheUrl(shop, row.id);
        warmed += 1;
      } catch (err) {
        await writeLog(config.shop, config.id, {
          action: "warm",
          urlId: row.id,
          status: "error",
          message: err instanceof Error ? err.message : "warm failed",
        });
      }
    }
  } finally {
    if (lock?.acquired) {
      await releaseCacheLock(lock.key, lock.token);
    }
  }
  return { warmed, skipped: false };
}

export async function warmEveryShop(): Promise<{ shops: number; registered: number }> {
  const registered = await registerKnownPersistedQueries();
  const configs = await db.cacheStoreConfig.findMany({
    where: { warmerEnabled: true },
    select: { shop: true },
  });
  if (configs.length === 0) {
    const fallback = process.env.SHOPIFY_STOREFRONT_DOMAIN;
    if (fallback) {
      await getOrCreateCacheConfig(fallback);
      await warmAllEnabledUrls(fallback);
      return { shops: 1, registered };
    }
    return { shops: 0, registered };
  }
  for (const row of configs) {
    await warmAllEnabledUrls(row.shop);
  }
  return { shops: configs.length, registered };
}
