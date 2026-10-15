# Current API, GraphQL & Cache Flow Audit

**Date:** 2026-09-21  
**Scope:** Repository `app-builder-mr-supplement` plus production observations of `https://appbuilder.dreamzapps.com` during the same day’s operations.  
**Status:** AUDIT ONLY — no implementation in this task.

Labels used throughout:

- **CURRENT** — present in code and/or observed in production.
- **PROPOSED** — future architecture; **not implemented** as a finished India/nginx/1,000,000-SKU system.

This app is **not Next.js**. It is a **Shopify embedded app** (React Router 7, Vite, TypeScript, Prisma + PostgreSQL). Production hostname `appbuilder.dreamzapps.com` is served as a **Vercel** deployment (observed `server: Vercel` / `x-vercel-id: bom1::iad1::…`) with **Cloudflare orange-cloud** in front (observed `server: cloudflare`, `cf-cache-status`, `cf-ray`). `agent.md` still mentions a VPS/`react-router-serve`/PM2 path; live HTTP headers on 2026-09-21 showed **Vercel + Cloudflare**.

---

## 1. Executive Summary

**CURRENT** public catalog path is a **transparent Storefront GraphQL gateway** at `GET|POST /graphql`, plus public CMS JSON at `GET /cms/pages`, `GET /cms/pages/:slug`, `GET /cms/settings`. The native mobile app is expected to call these hosts **directly** (no Shopify App Proxy).

**CURRENT** origin cache is **L1 in-process Map + L2 Redis** (`ioredis`, `REDIS_URL`). GraphQL cache keys are `shopify:graphql:storefront:{SHOPIFY_STOREFRONT_DOMAIN}:{16-hex}` from **query text + canonicalized variables**. Different `variables` JSON (after dropping nulls) is a **different Redis object**. Cloudflare (when proxied) caches **GET URL including query string**.

**CURRENT** admin Cache page (`/app/cache`) and Vercel cron `*/5` `/api/cron/cache-refresh` exist in this repo, including catalog listing/warming helpers (`app/lib/catalog-warm.server.ts`). Whether every production env var is set is **not fully known** from git.

**PROPOSED** (~20ms HIT from India, nginx on dd-106, ~2,200 first-page objects, 1,000,000 SKU catalog) is **not** the live serving path. Observed Cloudflare HIT from **dd-106** landed on **`SIN` / `HKG`**, reused-connection TTFB **~104ms**, not ~20ms.

There is **no** nginx `proxy_cache` config in this repository. dd-106 appears only as an **external** warm/`curl` host (`scripts/warm-edge.sh`).

---

## 2. Current Architecture

```text
Native app / curl / Postman
  → DNS appbuilder.dreamzapps.com
  → Cloudflare (orange-cloud; Cache Rules not in git)
      GET /graphql, /cms/*  → may be HIT at CF PoP
      POST /graphql, /app, /api, /auth, /webhooks → typically origin
  → Vercel (intake often bom1, function/origin iad1)  [CURRENT production headers]
      React Router routes
        GET/POST /graphql → validate → Redis L1/L2 → Shopify Storefront GraphQL
        GET /cms/*        → Redis L1/L2 → PostgreSQL (Page, ShopSettings)
        /app/*, /api/*    → authenticate.admin → Prisma + Admin GraphQL where needed
```

**CURRENT** Shopify Admin GraphQL is used for CMS media/files and collection-product picker in **admin**, not for the native catalog gateway.

**Single-shop Storefront gateway:** `SHOPIFY_STOREFRONT_DOMAIN` + `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (server env only). CMS public JSON can take `?shop=` but GraphQL Storefront calls always use the env domain.

---

## 3. Current Request Flow

### 3.1 Public GraphQL (native catalog) — CURRENT

```text
Client
  → GET /graphql?sha256=&variables=   (preferred, CDN-friendly)
    or GET /graphql?query=&variables=
    or POST /graphql  { query, variables?, cache? }
  → CORS (*), optional IP rate limit
  → ensureRuntimeCachePolicy()  (Prisma CacheStoreConfig, ~30s memory)
  → resolve APQ hash via Redis pq:{sha256} or CacheUrl.queryText
  → validateRequest (query string required if not hash-resolved)
  → executeStorefrontRequest
       L1 Map → L2 Redis → (MISS) callStorefrontWithProtection
            rate limits, circuit breaker, timeout, retries
            HTTPS Storefront GraphQL (API version default 2026-07)
  → Response JSON { data, errors?, extensions? } (Shopify body, no transform)
  → Headers: Cache-Control / CDN-Cache-Control (GET cacheable),
             X-Cache, X-Proxy-Duration-Ms, Server-Timing, X-Request-Id
```

### 3.2 Public CMS — CURRENT

```text
GET /cms/pages | /cms/pages/:slug | /cms/settings
  → shop = ?shop= or SHOPIFY_STOREFRONT_DOMAIN
  → withCache cms:* keys → Prisma published pages / ShopSettings
  → public JSON (settings stripped of admin-only fields)
```

### 3.3 What the template diagram is **not**

There is **no** Next.js layer, **no** App Proxy, **no** nginx in-repo, **no** REST `/api/v1/products`.

---

## 4. API Inventory

### 4.1 Public catalog / CMS (cacheable GET)

| Method | Path | Auth | Public | Input | Shopify | DB | Redis | Response | CURRENT caching |
|--------|------|------|--------|-------|---------|----|-------|----------|-----------------|
| GET/POST/OPTIONS | `/graphql` | None (Storefront token on server) | Yes | `query` or `sha256`, `variables` JSON, `cache=default\|bypass\|refresh` | Storefront GraphQL | Policy/stats optional | L1/L2 + `pq:` | Shopify JSON | GET: CDN headers + Redis. POST: `Cache-Control: no-store` (origin Redis still used) |
| GET/OPTIONS | `/cms/pages` | None | Yes | `?shop=`, `?cache=` | No | Page | `cms:pages:{shop}:list` | `{ success, pages }` | Same policy TTL |
| GET/OPTIONS | `/cms/pages/:slug` | None | Yes | slug, `?shop=` | No | Page | `cms:pages:{shop}:slug:{slug}` | Page JSON | Same |
| GET/OPTIONS | `/cms/settings` | None | Yes | `?shop=` | No | ShopSettings | `cms:settings:v3:{shop}` | Public settings + `cacheTtlSeconds` | Same |

**GraphQL operation names** are **not** parsed by the gateway. The gateway forwards the query document as-is. Native-app operations (from client source shared in chat, **not** stored as full documents in this repo except hashes):

| Operation | sha256 (CURRENT constants) | File in this repo |
|-----------|----------------------------|-------------------|
| `ProductsByCollectionId` | `759dff3d…6611` | `app/lib/storefront-query-hashes.ts` (hash only) |
| `ProductsByCollection` (handle) | `05d184d8…749f5` | same |
| `GetProductByProductId` | `22043217…7592` | same |
| `GetProductByHandle` | `5bba4cde…b3a4` | same |
| `GetProductsByIds` | `d7d84801…9d39` | same |

**Different hashes** exist in `app/lib/persisted-queries.ts` (`daea17f2…`, `a9099543…`) for **short demo** queries — they are **not** the native-app documents.

### 4.2 Admin (do not publicly cache)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| * | `/app`, `/app/*` | `authenticate.admin` | CMS editor, settings, Cache page `/app/cache`, OTA UI |
| GET/PUT | `/api/app/settings` | Admin session | Full `ShopSettings` |
| GET/POST | `/api/cms/pages`, `/api/cms/pages/:id` | Admin | CMS CRUD |
| GET/POST | `/api/cms/media` | Admin | Shopify Files **Admin** GraphQL |
| GET | `/api/cms/collection-products` | Admin | Admin GraphQL collection products |
| * | `/api/ota/*` | Admin | OTA dashboard proxy |
| * | `/auth/*` | OAuth | |
| GET/POST | `/api/cron/cache-refresh` | Vercel cron header / `CRON_SECRET` / `CACHE_CRON_SECRET` | Warm Redis catalog batch |
| GET/POST | `/api/cron/cache-urls` | Same cron auth | JSON list of catalog GET URLs for dd-106 |

### 4.3 Webhooks (CURRENT routes vs TOML)

| Route file | Topic | TOML-declared? |
|------------|-------|----------------|
| `webhooks.app.uninstalled` | `app/uninstalled` | Yes |
| `webhooks.app.scopes_update` | `app/scopes_update` | Yes |
| `webhooks.products.create/update/delete` | products/* | **No** in `shopify.app.toml` |
| `webhooks.collections.update` | collections/update | **No** in TOML |

Handlers call `invalidateStorefrontGraphqlCache(shop)` when reached. **CURRENT** Shopify may **not** deliver product/collection webhooks unless subscribed outside this file.

### 4.4 Other

| Path | Notes |
|------|--------|
| `/hot-updater/*` | OTA; `Cache-Control: private, no-cache` on blob GET — **do not public-cache** |
| `/pages/:slug` | HTML preview, not native JSON |

**Not found in this repo:** dedicated product search API, recommendations REST, related-products REST, inventory REST, `/api/v1/*`, `/api/upsells`, `/api/storefront/*`.

---

## 5. Shopify GraphQL Inventory

### 5.1 Storefront (public gateway) — CURRENT

The **gateway does not own** the native query documents. It executes whatever valid query is registered (APQ) or posted.

**Listing queries used only by catalog warmer** (`app/lib/catalog-warm.server.ts`):

- `CacheWarmCollections($first, $after)` — `id`, `handle`
- `CacheWarmProducts($first, $after)` — `id`, `handle`

**Native app queries (documents provided in planning chat; hashes in repo):**

| Query name | Operation | Variables (types) | Pagination / extra |
|------------|-----------|-------------------|-------------------|
| Products by collection ID | `ProductsByCollectionId` | `$id: ID!`, `$first: Int`, `$after: String`, `$sortKey`, `$reverse`, `$filters: [ProductFilter!]` | `products(first, after, sortKey, reverse, filters)` + metafields |
| Products by collection handle | `ProductsByCollection` | `$handle: String!`, same product args | `collectionByHandle` |
| Product by ID | `GetProductByProductId` | `$id: ID!` | images/media/variants/metafields |
| Product by handle | `GetProductByHandle` | `$handle: String!` | `productByHandle` |
| Products by IDs | `GetProductsByIds` | `$ids: [ID!]!` | `nodes(ids:)` |

Gateway **does not rewrite** variables except Redis key **canonicalization** (drop `null`/`undefined`, sort keys). Shopify still receives the client variables object from the parsed JSON (nulls may still be sent to Shopify).

### 5.2 Admin GraphQL — CURRENT (authenticated)

Used from `app/lib/shopify-files.server.ts`, `app/lib/shopify-collections.server.ts` (collection products picker). **Not** the native catalog path.

---

## 6. GraphQL Variables / Cache Object Analysis

**CURRENT Redis key:** `sha256(query.trim() + JSON.stringify(canonicalize(variables)))` truncated to 16 hex, prefixed `shopify:graphql:storefront:{domain}:`.

**CURRENT Cloudflare key:** full GET URL (query string included). `after:null` vs omitted `after` are **different CF objects** even if Redis keys match after canonicalize.

| Query | Endpoint | Variables | Distinct objects | Cacheable GET? | CURRENT cache |
|-------|----------|-----------|------------------|----------------|---------------|
| Collection by ID | GET `/graphql` | `id`, `first`, optional `after`, `filters`, `sortKey`, `reverse` | **Unbounded** if `after`/filters vary. **Not** derived as 100 from Shopify in git. Warmer **default max 100** collections × `first` (env `CACHE_WARM_COLLECTION_FIRST`, default 10) | Yes if GET sha256 | Redis + CF if proxied |
| Collection by handle | same | `handle`, `first`, … | Same pattern | Yes | same |
| Product by ID | same | `id` | One per product GID. Warmer **default max 1000** products | Yes | same |
| Product by handle | same | `handle` | One per handle | Yes | same |
| Products by IDs | same | `ids[]` | **Dynamic**; warmer stores **seen** lists in Redis `catalog-warm:seen-ids` (cap 200) | Yes | same |
| Search | **none in gateway** | — | — | — | N/A |
| CMS pages/settings | GET `/cms/*` | `shop`, slug | Per shop / slug | Yes | Redis + CF |

**Do not invent** 1,000,000 product cache objects. That figure is **PLANNED**, not a count from this codebase.

Demo hashes in `persisted-queries.ts` are additional **different** objects if used.

---

## 7. Current Redis Architecture

| Item | CURRENT |
|------|---------|
| Provider / region | **Not in git.** Env `REDIS_URL` only |
| Client | `ioredis` singleton `app/lib/redis-cache.server.ts` |
| Connect | TCP URL; `connectTimeout: 3000`; `maxRetriesPerRequest: 2` |
| GET/SET | JSON envelope `{ __swr, v, exp, staleUntil }`; SET with `EX` |
| SCAN/DEL | `cacheDel`, `cacheDelByPrefix` (invalidation) |
| Pipeline | Not used as a general pattern |
| MGET | Not the main GraphQL path |
| Lock | `lock:cache:` SET NX (`distributed-lock.server.ts`); GraphQL GET uses `distributed: false` |
| Rate limit | `rl:*` keys (protection) |
| Sessions | Shopify sessions are **Prisma**, not Redis |
| Queue | `config.queue` exists; **QUEUE_ENABLED** — not the GraphQL warmer |

**Key examples (tenant-aware unless noted):**

```text
shopify:graphql:storefront:{myshopify-domain}:{16hex}
cms:pages:{shop}:list
cms:pages:{shop}:slug:{slug}
cms:settings:v3:{shop}
pq:{64-hex-sha256}                    # APQ body — NOT shop-scoped
cacheurl:stat:{uniqueKey}:hit|miss
catalog-warm:ids
catalog-warm:cursor
catalog-warm:last:{path}
catalog-access:{sha256}:{varsJson}
catalog-warm:seen-ids
lock:cache:{...}
rl:...
```

**Collision risk:** `pq:` is global. GraphQL response keys include Storefront **domain**. CMS keys include shop. **Do not** flush `rl:*` / `pq:*` on “clear all” without intent.

Unused design: `app/lib/cache/catalog-cache.server.ts` (`catalog:v1:{storeId}:…`) — **not wired to routes**.

`app/lib/config.server.ts` TTL env (`CACHE_TTL_PRODUCT` etc.) is **not** what `getCacheTTL()` uses. Live policy is `CacheStoreConfig` + clamp **300–600s** for the **HTTP/global** Redis+CDN window; catalog warmer may pass **per-write** `redisTtlSeconds` (600 / 1800 / 86400) into `withCache`.

---

## 8. Current Cloudflare Architecture

**In git:** `docs/cloudflare-edge-cache.md` (runbook). **No** Workers, **no** Terraform, **no** Cache Rule JSON.

**Observed CURRENT (2026-09-21, `appbuilder.dreamzapps.com`):**

- `server: cloudflare`
- `cf-cache-status`: HIT, MISS, EXPIRED, UPDATING, (earlier) 308 cached redirects
- `cf-ray` from **dd-106**: **`SIN`**, **`HKG`** — not `BOM`
- GET `/graphql` **is** cached when Cache Rule + proxy are on
- POST is not used as the native hot path; POST must not be cached
- Query string is part of the cache key (different `variables` = different CF object)
- Origin also sends `CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control`, `Vercel-CDN-Cache-Control`
- Production was observed with `max-age=300` / `s-maxage=300` at times (admin default in code is 600s clamped 300–600)

**Hostname:** `appbuilder.dreamzapps.com` (Shopify `application_url`). Admin `/app` should be **bypass** in CF (documented; dashboard not in repo).

---

## 9. Current nginx / Infrastructure

| Item | CURRENT |
|------|---------|
| nginx.conf / sites-enabled / proxy_cache | **Not in this repository** |
| dd-106 | **External** Ubuntu host used for `curl` and `scripts/warm-edge.sh`. **Not** an app origin in git |
| Vercel | `vercel.json` cron; production `x-vercel-id` `bom1::iad1` |
| India cache endpoint as product API | **Not implemented** (no `api.` hostname in app config) |

**PROPOSED** nginx `proxy_cache` on dd-106 **can** cache GET by full URL; GraphQL **POST** is a poor cache target. Stale-while-revalidate / proxy_cache_lock would be new config. **Do not treat as CURRENT.**

---

## 10. Current Cache Behavior

### CURRENT HIT (Cloudflare)

```text
Client GET unique URL
  → CF PoP HIT
  → JSON from edge
  → Origin / Redis / Shopify not in path
  → Vercel logs typically absent
```

### CURRENT HIT (origin Redis, CF MISS)

```text
Client → CF MISS → Vercel
  → L2 Redis HIT (Server-Timing l2; X-Cache HIT)
  → no shopify_fetch
```

### CURRENT MISS

```text
CF MISS or no proxy
  → Redis MISS
  → shopify_fetch (Shopify HTTP)
  → write L1+L2
  → Cache-Control for CF
```

### CURRENT Shopify failure

```text
Timeout / 429 / 5xx / THROTTLED
  → retries (maxRetries default 3), Retry-After
  → circuit breaker may open
  → 429/503 JSON; shouldCache gates storing errors
```

### CURRENT Redis failure

```text
L1 only; app continues
  → more Shopify / Postgres load
```

### CURRENT Postgres timeout (observed)

```text
Prisma session table / CacheUrl stats
  → "Connection terminated due to connection timeout"
  → public GraphQL does not need Admin session; cold start still loads shopify.server.ts
```

---

## 11. Current Latency Measurements

**In-code instrumentation (CURRENT):**

- `X-Proxy-Duration-Ms`, `Server-Timing` (`l1`, `l2`, `shopify`/`origin`, `total`)
- Logs: `shopifyDurationMs`, `durationMs`, `cache` status
- Shopify timeout default **15s** (`SHOPIFY_STOREFRONT_TIMEOUT_MS`)

**Observed 2026-09-21 (operations, not a formal APM product):**

| Scenario | Measurement |
|----------|-------------|
| CF HIT + new TLS (dd-106, SIN) | TTFB **~345ms** |
| CF HIT + reused HTTP/2 (dd-106, SIN) | TTFB **~104ms** |
| CF EXPIRED (HKG) revalidate origin | TTFB **~3.64s** |
| Origin Redis HIT (`l2Ms`) | **~397–405ms** |
| Shopify fetch | **~75–268ms** (`shopifyDurationMs`); total origin MISS **~1.5–2.2s** in some logs |
| Cache warm overlapping / Prisma | multi-second / **~10s** lock wait (older code; wait now default **250ms**) |
| DNS / TCP / TLS split | **Measured ad hoc** (`time_namelookup`, `time_connect`, `time_appconnect`) — e.g. SIN TLS **~252ms** |
| Continuous APM dashboards | **Not currently measured** in-repo |

**~20ms is a cache-HIT target at a nearby PoP, not a guaranteed uncached API latency. CURRENT dd-106 HIT floor to SIN is ~100ms with keep-alive.**

---

## 12. Current Catalog Data Flow

**CURRENT:** Native app → `/graphql` with persisted hashes. Catalog IDs for warming: Storefront `collections` / `products` connections in `catalog-warm.server.ts` (caps **100** / **1000** by default env).

**CURRENT:** CMS homepage/tabs/collections references live in **PostgreSQL `ShopSettings`**, not a 1,000,000 product index.

**PLANNED:** 1,000,000 products as a store size — **not** a number this app enumerates.

---

## 13. Current Product Flow

```text
GET /graphql?sha256=22043217…&variables={"id":"gid://shopify/Product/…"}
GET /graphql?sha256=5bba4cde…&variables={"handle":"…"}
```

APQ must exist in Redis `pq:{hash}` (POST full query once). Gateway does not transform PDP JSON.

---

## 14. Current Collection Flow

```text
GET /graphql?sha256=759dff3d…&variables={"id":"gid://shopify/Collection/…","first":10,"after":null}
GET /graphql?sha256=05d184d8…&variables={"handle":"scivation","first":10,"after":null}
```

`after:null` is stripped for **Redis** keys. **CF** still keys the raw query string.

---

## 15. Current Products-by-IDs Flow

```text
GET /graphql?sha256=d7d84801…&variables={"ids":["gid://shopify/Product/…", …]}
```

Each unique `ids` array (after canonicalize/sort) is a **new** cache object. Pre-warm of all combinations is **not CURRENT**. Warmer may replay **seen** arrays from Redis.

---

## 16. Current Search Flow

**No** public Storefront search route in this app. Search-bar **CMS block** exists for page JSON; product search would be a **GraphQL query the app must POST/GET** like any other document — **not inventoried as a first-class API**.

---

## 17. Current Pagination Flow

Collection queries support `first` + `after` (+ filters/sort). Each cursor page is a **new** Redis and CF object. Warmer **first page only** (`first: 10` default). Page 2+ is **on-demand** unless listed as Cache URLs.

---

## 18. Cache-Key Analysis

| Layer | CURRENT key |
|-------|-------------|
| Redis GraphQL | domain + hash(query + canonical variables) |
| Cloudflare | Full URL (method GET, query string) |
| Vercel CDN | Full URL (`x-vercel-cache`) |
| CMS Redis | shop + list/slug/settings |
| Future nginx (PROPOSED) | Should use **full URL** or `sha256 + canonical variables + shop` |

**Future key (PROPOSED, not implemented):** shop/store, query hash, method, normalized variables, optional locale/currency/API version. **Do not** include customer/cart in public catalog keys.

**Collision:** two shops sharing one Storefront env = one GraphQL namespace (CURRENT single-shop). `pq:` global.

---

## 19. Cacheability Analysis

**PROPOSED FUTURE ARCHITECTURE** (not a CURRENT enforcement list):

| Class | Examples |
|-------|----------|
| PRE-WARM | Collection by ID/handle first page; product by ID/handle (~2,200 URLs if 100+1000) |
| ON-DEMAND CACHE | `after` pages, filters, sort, products-by-ids lists, related metafields expansions |
| DO NOT CACHE | Admin `/app` `/api` `/auth` `/webhooks`; OTA private; POST `/graphql` at the edge; personalized/cart/customer |

**CURRENT:** anything GET `/graphql` that returns 200 JSON with public Cache-Control **can** be cached by CF if rules allow — including search if the app sent it.

---

## 20. 2,200-Object Pre-Warm Feasibility

| Bucket | CURRENTLY IMPLEMENTED | PLANNED / EXPECTED |
|--------|----------------------|-------------------|
| ~100 collection-by-ID | Warmer lists up to `CACHE_WARM_MAX_COLLECTIONS` (default **100**) | Store may have more |
| ~100 collection-by-handle | Same list `handle` field | |
| ~1,000 product-by-ID | `CACHE_WARM_MAX_PRODUCTS` default **1000** | User also cited **1,000,000** SKUs — **not** warmed |
| ~1,000 product-by-handle | Same product list | |
| Products-by-IDs | Seen-set only | Dynamic |
| Page 2+ / filters | Not pre-warmed | Dynamic |

Discovery: **Shopify Storefront pagination** in warmer, not Prisma catalog tables (catalog read-model migration exists historically; **not** the live native path).

**Fits CURRENT app as a warmer design; does not mean production has finished warming 2,200 CF objects at BOM.**

---

## 21. Cache-Warming Feasibility

**CURRENT:**

- Vercel cron `*/5` → `/api/cron/cache-refresh` (`maxDuration` 300)
- Auth: `x-vercel-cron: 1`, `vercel-cron/` UA, or secrets
- `warmEveryShop` + `warmCatalogRedisBatch` (batch default **40**, concurrency **4**)
- Hot/warm/cold **logic in code** (10 min / 30 min / 1 day Redis TTL on writes)
- `scripts/warm-edge.sh` + `/api/cron/cache-urls` for Mumbai **GET** fill
- In-process interval warmer **disabled on Vercel**; not started from `/graphql`

**CURRENT Shopify protection:** global 600 Storefront calls/min default; miss per IP 120; retries; circuit breaker. **40 jobs / 5 min** is compatible **if** most are Redis HIT.

**No** job table / durable queue for warm jobs (`QUEUE_ENABLED` unused for this).

---

## 22. Shopify Throttling / Rate Limits

**CURRENT** (`protection/config.server.ts`, `storefront-fetch.server.ts`):

- HTTP 429 / 5xx retry, jittered backoff, `Retry-After`
- GraphQL `THROTTLED` / message “throttled”
- IP and cache-key and global Shopify miss limits via Redis
- Circuit breaker: failure threshold, open ms, half-open
- Timeout 15s default

Cost/points from Shopify extensions: **logged only insofar as body is returned**; no separate cost accounting UI.

---

## 23. Cache Invalidation

**CURRENT:**

- CMS/settings save: Redis delete of CMS keys
- Cache page: per-URL Redis delete + log
- Product/collection webhook **code** → prefix delete Storefront keys
- **TOML does not subscribe** product/collection webhooks
- **Cloudflare purge is not called from application code** (`NoopCdnProvider` mentioned in older notes)
- Deploy does not purge CF (ops must Custom Purge)

**PROPOSED invalidation:** targeted keys by product/collection GID; CF purge by URL; nginx PURGE; do not FLUSHDB.

---

## 24. Admin Settings Architecture

| Item | CURRENT |
|------|---------|
| Shop settings | Prisma `ShopSettings` via `/app/settings`, `PUT /api/app/settings`, `authenticate.admin` |
| Cache policy | Prisma `CacheStoreConfig` + `/app/cache` (TTL 300–600, Redis/CDN/warmer checkboxes, URL table, logs) |
| Who | Shopify Admin session (embedded app) |

**PROPOSED extra knobs** (nginx ON/OFF, 1-day cold TTL UI, jobs/batch): **not** all on Settings; some exist only as **env** (`CACHE_WARM_*`).

---

## 25. Future Cache-Clear Requirements

| Action | CURRENT support |
|--------|-----------------|
| Clear one Cache URL | Yes (`/app/cache`) |
| Clear all Redis catalog | Prefix delete exists; **not** a single “clear 1M products” UI |
| Clear CF | Manual dashboard / future API |
| Clear nginx | N/A until nginx exists |
| Clear upsell | No upsell API |
| Flush Redis | Must **not** be used (rate limit + APQ) |

---

## 26. Security Findings

| Topic | CURRENT |
|-------|---------|
| Storefront token | Server env **Present** (value not in git) |
| Public `/graphql` | Unauthenticated; read-only Storefront token; CORS `*` |
| Admin APIs | Shopify session **Present** |
| Shop isolation | GraphQL **single env shop**; CMS `?shop=` |
| Cache poisoning | GET query string is the CF key; POST not edge-cached |
| Personalized/cart | Not in gateway responses |
| Cron | Secret / Vercel header; `/api/cron/*` should stay CF **bypass** |
| Secrets in this audit | **Not printed** |

---

## 27. Performance Bottlenecks

| Severity | Problem | Evidence | Endpoint | Impact | Future direction (not implemented here) |
|----------|---------|----------|----------|--------|----------------------------------------|
| CRITICAL | CF EXPIRED → US origin multi-second | HKG TTFB ~3.6s | GET `/graphql` | Worst-case UX | Longer CF edge TTL; serve stale while revalidate |
| HIGH | CF PoP SIN/HKG from India test host | `cf-ray` …-SIN | GET `/graphql` | HIT ~104ms ≠ 20ms | India origin/cache (nginx) or phone on BOM |
| HIGH | New TLS each request | r1 ~345ms vs r2 ~104ms | GET `/graphql` | App looks slow | HTTP/2 keep-alive in native client |
| HIGH | Distinct variables = miss | Logs `sha256=6bef687d…` vs `759dff3d…` | GET `/graphql` | Shopify on unknown URLs | Warm known hashes; on-demand cache others |
| HIGH | Cron 401 (historical) | Vercel log Unauthorized | `/api/cron/cache-refresh` | Redis not filled | Deploy cron auth (in repo) |
| MEDIUM | Redis L2 ~400ms from iad1 | `l2Ms:405` | origin HIT | CF MISS still slow | Keep CF HIT; Redis closer to origin |
| MEDIUM | Prisma on cold start | session table timeout | any lambda | Extra delay | Isolate public `/graphql` from Admin session storage (**PROPOSED**) |
| MEDIUM | Huge query documents | Native queries | Storefront | Cost/timeout | Already APQ by hash |
| LOW | Access stats previously on Postgres | timeout logs | GET `/graphql` | Pool stall | Redis-only stats (in repo) |

---

## 28. Recommended Future Architecture

**PROPOSED — NOT IMPLEMENTED**

```text
Mobile (HTTP/2 keep-alive)
   ↓
India cache hostname (dd-106 nginx proxy_cache)     ← ~20ms HIT target
   ↓ MISS
appbuilder.dreamzapps.com (Cloudflare + Vercel)
   ↓
Redis L1/L2
   ↓ MISS
Shopify Storefront GraphQL
```

With:

- ~2,200 first-page objects (100 collections × 2 + 1000 products × 2)
- on-demand page/filter/sort/ids-list caching
- hot / warm / cold Redis TTLs (partially **CURRENT** in warmer code)
- background warming (partially **CURRENT** cron + script)
- targeted invalidation + CF/nginx purge (**incomplete CURRENT**)

Admin remains on `appbuilder.dreamzapps.com` with CF **bypass** for `/app`.

---

## 29. Open Questions / Missing Information

- Exact production `REDIS_URL` region and whether it is shared
- Whether product/collection webhooks are subscribed in Partner Dashboard despite TOML
- Native app HTTP client keep-alive / HTTP/3
- True collection/product counts on `mr-supplement-2.myshopify.com` (not in git)
- Whether `CACHE_WARM_PRODUCT_SHA256` and APQ bodies for all five hashes are in **production Redis**
- Cloudflare plan (Argo, cache TTL override actually saved)
- Why dd-106 anycast prefers SIN/HKG vs BOM
- `OTA_SHOP` unset (OTA only)

---

## 30. Implementation Phases

**Do not start until this audit is approved.**

1. Ops: CF edge TTL + serve-stale; purge 308s; confirm cron 200.  
2. Native: keep-alive; sha256-only URLs (no giant `?query=`).  
3. Finish warming 2,200 at origin Redis + dd-106 GETs.  
4. **PROPOSED** India nginx hostname if 20ms is mandatory.  
5. Subscribe catalog webhooks; CF purge API; never FLUSHDB.  
6. Only then consider 1,000,000 SKU (on-demand, not pre-warm all).

---

## 31. What Must NOT Be Changed Yet

Per this audit task: **no** further API/GraphQL/Redis/nginx/Cloudflare/schema/auth/behavior changes until review.

Do **not** treat `app/lib/config.server.ts` product TTL env as live gateway policy.  
Do **not** cache `/app`, `/auth`, `/api` (except intentional cron), `/webhooks`, `/hot-updater` blobs.  
Do **not** claim 20ms on `cf-ray: SIN`.

---

## Key file locations (CURRENT)

| File | Role |
|------|------|
| `app/routes/graphql.tsx` | Public Storefront gateway |
| `app/lib/shopify-storefront.server.ts` | Shopify fetch + `withCache` |
| `app/lib/redis-cache.server.ts` | L1/L2, APQ, keys, canonicalize |
| `app/lib/catalog-warm.server.ts` | List IDs + batch warm + access tiers |
| `app/lib/storefront-query-hashes.ts` | Native sha256 constants |
| `app/lib/persisted-queries.ts` | Demo queries (different hashes) |
| `app/lib/cache-store.server.ts` | Admin Cache URLs, cron warm shops |
| `app/lib/cache-policy.server.ts` | TTL clamp 300–600 for HTTP policy |
| `app/lib/cms-public.server.ts` | Public CMS JSON |
| `app/lib/protection/*` | Rate limit, circuit, webhooks invalidate |
| `app/routes/app.cache.tsx` | Admin Cache UI |
| `app/routes/api.cron.cache-refresh.tsx` | 5-min cron |
| `app/routes/api.cron.cache-urls.tsx` | URL list for dd-106 |
| `scripts/warm-edge.sh` | Mumbai GET warmer |
| `docs/cloudflare-edge-cache.md` | CF runbook |
| `vercel.json` | Cron schedule |
| `shopify.app.toml` | Host, webhooks (app only), scopes |
| `prisma/schema.prisma` | Session, Page, ShopSettings, Cache* |

---

*End of audit. No production behavior was changed in this documentation-only task.*
