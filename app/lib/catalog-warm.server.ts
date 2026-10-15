import { STOREFRONT_PQ, collectionByHandleVariables, collectionByIdVariables } from "./storefront-query-hashes";
import {
  buildCacheKey,
  cacheDel,
  canonicalGraphqlGetPath,
  canonicalizeGraphqlVariables,
  getPersistedQuery,
  getRedisClient,
} from "./redis-cache.server";
import { executeStorefrontRequest, getStorefrontConfig } from "./shopify-storefront.server";
import { callStorefrontWithProtection } from "./protection/storefront-fetch.server";
import type { CacheMode } from "./redis-cache.server";

const LIST_COLLECTIONS = `query CacheWarmCollections($first: Int!, $after: String) {
  collections(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node { id handle } }
  }
}`;

const LIST_PRODUCTS = `query CacheWarmProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node { id handle } }
  }
}`;

const HOT_MS = 10 * 60 * 1000;
const WARM_MS = 30 * 60 * 1000;
const COLD_MS = 24 * 60 * 60 * 1000;

const TTL_HOT = 600;
const TTL_WARM = 1800;
const TTL_COLD = 86400;

const SEEN_EXTRA_KEY = "catalog-warm:seen-extra";

type CatalogIds = {
  collections: Array<{ id: string; handle: string }>;
  products: Array<{ id: string; handle: string }>;
};

type WarmJob = {
  sha256: string;
  query: string;
  variables: Record<string, unknown>;
  path: string;
};

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function catalogWarmLimits() {
  return {
    maxCollections: envInt("CACHE_WARM_MAX_COLLECTIONS", 500),
    maxProducts: envInt("CACHE_WARM_MAX_PRODUCTS", 10_000),
    collectionFirst: envInt("CACHE_WARM_COLLECTION_FIRST", 10),
    batch: envInt("CACHE_WARM_BATCH", 400),
    concurrency: envInt("CACHE_WARM_CONCURRENCY", 8),
  };
}

export function catalogAccessKey(sha256: string, variables: Record<string, unknown>): string {
  const vars = JSON.stringify(canonicalizeGraphqlVariables(variables));
  return `catalog-access:${sha256}:${vars}`;
}

export async function touchCatalogAccess(
  sha256: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !sha256) return;
  const now = Date.now();
  const canonical = canonicalizeGraphqlVariables(variables);
  await redis.set(catalogAccessKey(sha256, variables), String(now), "EX", 60 * 60 * 24 * 30);
  if (sha256 === STOREFRONT_PQ.productsByIds || canonical.after) {
    await redis.sadd(SEEN_EXTRA_KEY, JSON.stringify({ sha256, variables: canonical }));
    await redis.expire(SEEN_EXTRA_KEY, 60 * 60 * 24 * 30);
  }
  if (sha256 === STOREFRONT_PQ.productsByIds) {
    const vars = JSON.stringify(canonical);
    await redis.sadd("catalog-warm:seen-ids", vars);
    await redis.expire("catalog-warm:seen-ids", 60 * 60 * 24 * 30);
  }
}

async function storefrontList(
  query: string,
  variables: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const config = getStorefrontConfig();
  if (!config) return null;
  const { body, status } = await callStorefrontWithProtection(config, {
    query,
    variables,
    cacheKey: "catalog-warm-list",
  });
  if (status >= 400 || body.errors?.length) {
    console.error(
      "[catalog-warm] list error:",
      body.errors?.map((e) => e.message).join("; ") || status,
    );
    return null;
  }
  return (body.data as Record<string, unknown>) ?? null;
}

export async function loadCatalogIds(): Promise<CatalogIds> {
  const limits = catalogWarmLimits();
  const redis = getRedisClient();
  const cacheKey = `catalog-warm:ids:${limits.maxCollections}:${limits.maxProducts}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CatalogIds;
        if (Array.isArray(parsed.collections)) return parsed;
      } catch {
        /* list again */
      }
    }
  }

  const collections: Array<{ id: string; handle: string }> = [];
  let after: string | undefined;
  while (collections.length < limits.maxCollections) {
    const data = await storefrontList(LIST_COLLECTIONS, {
      first: Math.min(50, limits.maxCollections - collections.length),
      ...(after ? { after } : {}),
    });
    const conn = data?.collections as {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
      edges?: Array<{ node?: { id?: string; handle?: string } }>;
    };
    for (const edge of conn?.edges ?? []) {
      if (edge.node?.id) {
        collections.push({ id: edge.node.id, handle: edge.node.handle || "" });
      }
    }
    if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }

  const products: Array<{ id: string; handle: string }> = [];
  after = undefined;
  while (products.length < limits.maxProducts) {
    const data = await storefrontList(LIST_PRODUCTS, {
      first: Math.min(50, limits.maxProducts - products.length),
      ...(after ? { after } : {}),
    });
    const conn = data?.products as {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
      edges?: Array<{ node?: { id?: string; handle?: string } }>;
    };
    for (const edge of conn?.edges ?? []) {
      if (edge.node?.id) {
        products.push({ id: edge.node.id, handle: edge.node.handle || "" });
      }
    }
    if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }

  const catalog = { collections, products };
  if (redis) {
    await redis.set(cacheKey, JSON.stringify(catalog), "EX", 1800);
  }
  return catalog;
}

export function catalogGraphqlPaths(catalog: CatalogIds): string[] {
  const limits = catalogWarmLimits();
  const paths: string[] = [];
  for (const row of catalog.collections) {
    paths.push(
      canonicalGraphqlGetPath(
        STOREFRONT_PQ.productsByCollectionId,
        collectionByIdVariables(row.id, limits.collectionFirst),
      ),
    );
    if (row.handle) {
      paths.push(
        canonicalGraphqlGetPath(
          STOREFRONT_PQ.productsByCollectionHandle,
          collectionByHandleVariables(row.handle, limits.collectionFirst),
        ),
      );
    }
  }
  for (const product of catalog.products) {
    paths.push(canonicalGraphqlGetPath(STOREFRONT_PQ.productById, { id: product.id }));
    if (product.handle) {
      paths.push(
        canonicalGraphqlGetPath(STOREFRONT_PQ.productByHandle, { handle: product.handle }),
      );
    }
  }
  return paths;
}

async function resolveNativeQuery(sha256: string): Promise<string | null> {
  const fromRedis = await getPersistedQuery(sha256);
  if (fromRedis) return fromRedis;
  // Redis lost the PQ mapping (eviction/restart) — fall back to the built-in
  // catalog + DB so webhook re-warms can never silently no-op. Dynamic import
  // avoids a static cycle (cache-store imports this module).
  const { lookupPersistedQueryText } = await import("./cache-store.server");
  const known = await lookupPersistedQueryText(sha256);
  if (known) {
    const { setPersistedQuery } = await import("./redis-cache.server");
    await setPersistedQuery(known, sha256); // re-register in Redis for next time
  }
  return known;
}

async function buildJobs(catalog: CatalogIds): Promise<WarmJob[]> {
  const limits = catalogWarmLimits();
  const jobs: WarmJob[] = [];
  const qId = await resolveNativeQuery(STOREFRONT_PQ.productsByCollectionId);
  const qHandle = await resolveNativeQuery(STOREFRONT_PQ.productsByCollectionHandle);
  const qProductId = await resolveNativeQuery(STOREFRONT_PQ.productById);
  const qProductHandle = await resolveNativeQuery(STOREFRONT_PQ.productByHandle);
  const qByIds = await resolveNativeQuery(STOREFRONT_PQ.productsByIds);

  const seen = new Set<string>();
  const push = (sha256: string, query: string | null, variables: Record<string, unknown>) => {
    if (!query) return;
    const path = canonicalGraphqlGetPath(sha256, variables);
    if (seen.has(path)) return;
    seen.add(path);
    jobs.push({ sha256, query, variables, path });
  };

  for (const row of catalog.collections) {
    push(
      STOREFRONT_PQ.productsByCollectionId,
      qId,
      collectionByIdVariables(row.id, limits.collectionFirst),
    );
    if (row.handle) {
      push(
        STOREFRONT_PQ.productsByCollectionHandle,
        qHandle,
        collectionByHandleVariables(row.handle, limits.collectionFirst),
      );
    }
  }
  for (const product of catalog.products) {
    push(STOREFRONT_PQ.productById, qProductId, { id: product.id });
    if (product.handle) {
      push(STOREFRONT_PQ.productByHandle, qProductHandle, { handle: product.handle });
    }
  }

  const redis = getRedisClient();
  if (redis && qByIds) {
    const byIds = await redis.smembers("catalog-warm:seen-ids");
    for (const raw of byIds.slice(0, 500)) {
      try {
        push(STOREFRONT_PQ.productsByIds, qByIds, JSON.parse(raw) as Record<string, unknown>);
      } catch {
        /* skip */
      }
    }
  }
  if (redis) {
    const extra = await redis.smembers(SEEN_EXTRA_KEY);
    for (const raw of extra.slice(0, 2000)) {
      try {
        const parsed = JSON.parse(raw) as {
          sha256?: string;
          variables?: Record<string, unknown>;
        };
        if (!parsed.sha256 || !parsed.variables) continue;
        const query = await resolveNativeQuery(parsed.sha256);
        push(parsed.sha256, query, parsed.variables);
      } catch {
        /* skip */
      }
    }
  }
  return jobs;
}

type Tier = "hot" | "warm" | "cold";

/** Never-warmed predefined URLs are always due so the first shopper is a HIT. */
export function classifyWarmSchedule(
  lastWarm: number,
  lastAccess: number,
  now = Date.now(),
): { due: boolean; tier: Tier; ttl: number; mode: CacheMode } {
  if (!lastWarm) {
    return { due: true, tier: "hot", ttl: TTL_WARM, mode: "refresh" };
  }
  if (lastAccess && now - lastAccess <= HOT_MS) {
    return { due: now - lastWarm >= HOT_MS / 2, tier: "hot", ttl: TTL_HOT, mode: "refresh" };
  }
  if (lastAccess && now - lastAccess <= COLD_MS) {
    return { due: now - lastWarm >= WARM_MS / 2, tier: "warm", ttl: TTL_WARM, mode: "refresh" };
  }
  if (!lastAccess) {
    return { due: now - lastWarm >= WARM_MS / 2, tier: "warm", ttl: TTL_WARM, mode: "refresh" };
  }
  return { due: now - lastWarm >= COLD_MS, tier: "cold", ttl: TTL_COLD, mode: "refresh" };
}

async function classify(
  job: WarmJob,
): Promise<{ due: boolean; tier: Tier; ttl: number; mode: CacheMode }> {
  const redis = getRedisClient();
  let lastAccess = 0;
  let lastWarm = 0;
  if (redis) {
    lastAccess = Number((await redis.get(catalogAccessKey(job.sha256, job.variables))) || 0);
    lastWarm = Number((await redis.get(`catalog-warm:last:${job.path}`)) || 0);
  }
  return classifyWarmSchedule(lastWarm, lastAccess);
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const n = Math.max(1, concurrency);
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        await worker(items[current]);
      }
    }),
  );
}

function edgeWarmHosts(): string[] {
  const origin = (process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com").replace(
    /\/$/,
    "",
  );
  const india = (process.env.CACHE_INDIA_WARM_HOST || "").replace(/\/$/, "");
  const hosts = [origin];
  if (india && india !== origin) hosts.push(india);
  return hosts;
}

function withRefreshParam(url: string): string {
  if (/[?&]cache=/.test(url)) return url;
  return url.includes("?") ? `${url}&cache=refresh` : `${url}?cache=refresh`;
}

async function fillEdgeCache(pathAndQuery: string): Promise<void> {
  if (process.env.VITEST) return;
  const path = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : pathAndQuery.startsWith("/")
      ? pathAndQuery
      : `/${pathAndQuery}`;
  const origin = (process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com").replace(
    /\/$/,
    "",
  );
  for (const host of edgeWarmHosts()) {
    let url = path.startsWith("http") ? path : `${host}${path}`;
    // Origin sits behind Cloudflare, which caches the canonical GET. Warm via
    // cache=refresh so we hit Redis/Shopify, not a stale CF HIT.
    if (host === origin || url.startsWith(origin)) url = withRefreshParam(url);
    try {
      const res = await fetch(url, {
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
        "[catalog-warm] edge fill failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * After Redis is fresh and CF has been purged: GET the public (cacheable)
 * origin URL so Tiered Cache / Cache Reserve can store a copy. Do not use
 * cache=refresh here — that response is no-store and will not fill CF.
 */
export async function fillCloudflareCache(urls: string[]): Promise<string> {
  if (process.env.VITEST) return "skipped_test";
  const { isCdnProviderConfigured } = await import("./protection/cdn-provider.server");
  if (!isCdnProviderConfigured()) {
    console.warn(
      JSON.stringify({
        event: "cf_fill_skipped",
        reason: "CF_ZONE_ID or CF_API_TOKEN unset",
      }),
    );
    return "skipped_no_token";
  }
  const origin = (
    process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com"
  ).replace(/\/$/, "");
  let ok = 0;
  let attempted = 0;
  for (const raw of urls) {
    let url = raw;
    try {
      if (!/^https?:\/\//i.test(raw)) {
        url = `${origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
      }
      const parsed = new URL(url);
      parsed.searchParams.delete("cache");
      url = parsed.toString();
    } catch {
      continue;
    }
    attempted += 1;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      await res.arrayBuffer();
      if (res.ok) ok += 1;
    } catch (err) {
      console.error(
        "[catalog-warm] cf fill failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  console.log(JSON.stringify({ event: "cf_fill", ok, attempted }));
  return `filled ${ok}/${attempted}`;
}

type RunnableJob = WarmJob & { ttl: number; mode: CacheMode };

async function runJobs(jobs: RunnableJob[]): Promise<{ warmed: number; skipped: number }> {
  const redis = getRedisClient();
  let warmed = 0;
  let skipped = 0;
  const limits = catalogWarmLimits();
  await runPool(jobs, limits.concurrency, async (job) => {
    try {
      const result = await executeStorefrontRequest(job.query, job.variables, job.mode, {
        redisTtlSeconds: job.ttl,
      });
      if (result.cacheStatus === "HIT" || result.cacheStatus === "STALE") skipped += 1;
      else warmed += 1;
      await fillEdgeCache(job.path);
      if (redis) {
        await redis.set(`catalog-warm:last:${job.path}`, String(Date.now()), "EX", COLD_MS / 1000);
      }
    } catch (err) {
      console.error("[catalog-warm] item failed:", err instanceof Error ? err.message : err);
    }
  });
  return { warmed, skipped };
}

export async function warmCatalogRedisBatch(): Promise<{
  collections: number;
  products: number;
  jobs: number;
  due: number;
  warmed: number;
  skipped: number;
}> {
  const catalog = await loadCatalogIds();
  const limits = catalogWarmLimits();
  const jobs = await buildJobs(catalog);

  const ranked: Array<WarmJob & { ttl: number; mode: CacheMode; tier: Tier }> = [];
  for (const job of jobs) {
    const decision = await classify(job);
    if (!decision.due) continue;
    ranked.push({ ...job, ...decision });
  }
  ranked.sort((a, b) => {
    const order = { hot: 0, warm: 1, cold: 2 };
    return order[a.tier] - order[b.tier];
  });
  const batch = ranked.slice(0, limits.batch);
  const { warmed, skipped } = await runJobs(batch);
  const origin = (process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com").replace(
    /\/$/,
    "",
  );
  await fillCloudflareCache([
    ...batch.map((job) => `${origin}${job.path}`),
    `${origin}/cms/pages`,
    `${origin}/cms/settings`,
  ]);

  return {
    collections: catalog.collections.length,
    products: catalog.products.length,
    jobs: jobs.length,
    due: ranked.length,
    warmed,
    skipped,
  };
}

function graphqlGid(resource: "Product" | "Collection", payload: unknown): {
  id: string;
  handle: string;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as { admin_graphql_api_id?: string; id?: number | string; handle?: string };
  const id =
    typeof row.admin_graphql_api_id === "string" && row.admin_graphql_api_id.includes(resource)
      ? row.admin_graphql_api_id
      : row.id != null
        ? `gid://shopify/${resource}/${row.id}`
        : "";
  if (!id) return null;
  return { id, handle: typeof row.handle === "string" ? row.handle : "" };
}

/** After a catalog webhook: refresh Redis + edge for that product or collection only. */
export async function rewarmCatalogWebhookPayload(
  topic: string,
  payload: unknown,
): Promise<{ urls: string[]; warmed: number }> {
  const limits = catalogWarmLimits();
  const jobs: WarmJob[] = [];
  const push = async (
    sha256: string,
    variables: Record<string, unknown>,
  ) => {
    const query = await resolveNativeQuery(sha256);
    if (!query) return;
    jobs.push({
      sha256,
      query,
      variables,
      path: canonicalGraphqlGetPath(sha256, variables),
    });
  };

  if (topic.startsWith("products/")) {
    const product = graphqlGid("Product", payload);
    if (product) {
      await push(STOREFRONT_PQ.productById, { id: product.id });
      if (product.handle) {
        await push(STOREFRONT_PQ.productByHandle, { handle: product.handle });
      }
    }
  }
  if (topic.startsWith("collections/")) {
    const collection = graphqlGid("Collection", payload);
    if (collection) {
      await push(
        STOREFRONT_PQ.productsByCollectionId,
        collectionByIdVariables(collection.id, limits.collectionFirst),
      );
      if (collection.handle) {
        await push(
          STOREFRONT_PQ.productsByCollectionHandle,
          collectionByHandleVariables(collection.handle, limits.collectionFirst),
        );
      }
    }
  }

  const withTtl = jobs.map((job) => ({
    ...job,
    ttl: TTL_WARM,
    mode: "refresh" as CacheMode,
    tier: "hot" as Tier,
  }));
  const { warmed } = await runJobs(withTtl);
  return { urls: jobs.map((job) => job.path), warmed };
}

/**
 * After a delete webhook (e.g. products/delete): do NOT re-fetch the (now
 * gone) resource from Shopify. Compute the same canonical URLs + Redis/L1
 * keys the gateway would have written and delete them. The URLs are returned
 * so the caller can purge them at the CDN / edge as well.
 */
export async function purgeCatalogWebhookPayload(
  topic: string,
  payload: unknown,
): Promise<{ urls: string[]; purged: number }> {
  const config = getStorefrontConfig();
  const limits = catalogWarmLimits();
  const specs: Array<{ sha256: string; variables: Record<string, unknown> }> = [];

  if (topic.startsWith("products/")) {
    const product = graphqlGid("Product", payload);
    if (product) {
      specs.push({ sha256: STOREFRONT_PQ.productById, variables: { id: product.id } });
      if (product.handle) {
        specs.push({
          sha256: STOREFRONT_PQ.productByHandle,
          variables: { handle: product.handle },
        });
      }
    }
  }
  if (topic.startsWith("collections/")) {
    const collection = graphqlGid("Collection", payload);
    if (collection) {
      specs.push({
        sha256: STOREFRONT_PQ.productsByCollectionId,
        variables: collectionByIdVariables(collection.id, limits.collectionFirst),
      });
      if (collection.handle) {
        specs.push({
          sha256: STOREFRONT_PQ.productsByCollectionHandle,
          variables: collectionByHandleVariables(collection.handle, limits.collectionFirst),
        });
      }
    }
  }

  const urls: string[] = [];
  let purged = 0;
  for (const spec of specs) {
    urls.push(canonicalGraphqlGetPath(spec.sha256, spec.variables));
    const query = await resolveNativeQuery(spec.sha256);
    if (!query || !config) continue;
    // Same key formula executeStorefrontRequest() uses when writing the cache.
    const key = buildCacheKey(`storefront:${config.domain}`, query, spec.variables);
    await cacheDel(key); // L1 memory + Redis
    purged += 1;
  }
  return { urls, purged };
}
