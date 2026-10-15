# API performance audit — App Builder MR-Supplement

**Date:** 2026-09-21  
**Scope:** read-only audit. No Redis/Cloudflare/admin-cache implementation in this phase.  
**Constraint:** ~10ms is a **Cloudflare edge HIT target for public GET APIs**, not a promise for Shopify misses, admin APIs, or first-byte from a distant origin.

---

## Current architecture

This is **not** a Next.js `app/api` or `pages/api` app.

```text
Native app / browser
        ↓
Cloudflare (proxied hostname appbuilder.dreamzapps.com)
        ↓  [Cache Rule required or cf-cache-status=DYNAMIC]
Node origin — React Router 7 (`react-router-serve`, VPS PM2 :3500)
        ↓
L1 in-process Map  →  L2 Redis (optional ioredis)  →  PostgreSQL and/or Shopify
```

**Deploy:** GitHub Actions → VPS `/var/www/html/App-Builder-Supplement` (see `.github/workflows/deploy.yml`). AGENTS.md also mentions Vercel; production hostname used by CMS docs is `appbuilder.dreamzapps.com`.

**No Cloudflare Worker** in this repository. Simplest path is **Cache Rules + origin Cache-Control**, already documented in `docs/cloudflare-edge-cache.md`.

```text
Browser
 → Cloudflare (optional edge cache on GET /graphql, /cms/*)
 → Next hop is Node, not Next.js
 → Redis L2 + memory L1
 → PostgreSQL (CMS/settings) or Shopify Storefront GraphQL
```

---

## API inventory

| Endpoint | Method | Purpose | Auth | Data source | Current cache | Latency (this audit) | Class | Cache candidate | Recommended | TTL (start) | Invalidation |
|----------|--------|---------|------|-------------|---------------|----------------------|-------|-----------------|-------------|-------------|--------------|
| `/cms/settings` | GET | Public native-app config | None (shop query/env) | PostgreSQL `ShopSettings` | L1/L2 + `Cache-Control public s-maxage` | **Live 200**; layer split **unmeasured** | Public | Yes | Redis + Cloudflare | 30–60s (today 300s) | Redis on settings save; CF URL purge not coded |
| `/cms/pages` | GET | Published page list | None | PostgreSQL `Page` | Same | Unmeasured | Public | Yes | Redis + CF | 30–60s | CMS publish/unpublish |
| `/cms/pages/:slug` | GET | Published page JSON | None | PostgreSQL | Same; 404 `no-store` | Unmeasured | Public | Yes | Redis + CF | 30–60s | Same |
| `/graphql` | GET | Storefront GraphQL | None | Shopify Storefront API | L1/L2 + public Cache-Control | Unmeasured | Public catalog | Yes (GET) | Redis + CF | 30–300s by query type later | Product webhooks (if registered) + prefix delete |
| `/graphql` | POST | Same + APQ register | None | Storefront | Redis L1/L2; **should be no-store at CDN** | Unmeasured | Public catalog | Redis only | Redis; **no CF** | same | same |
| `/graphql` OPTIONS | OPTIONS | CORS | None | — | CORS max-age 86400 | — | Public | n/a | n/a | — | — |
| `/api/app/settings` | GET/PUT | Merchant settings | Admin session | PostgreSQL | None | Unmeasured | Admin | NO public | Private / Redis-off | — | Already invalidates `cms:settings` |
| `/api/cms/pages` | GET/POST | CMS list/create | Admin | PostgreSQL | None | Unmeasured | Admin | NO | none | — | Invalidates public CMS keys |
| `/api/cms/pages/:id` | GET/PUT/DELETE | CMS item | Admin | PostgreSQL | None | Unmeasured | Admin | NO | none | — | Same |
| `/api/cms/media` | GET/POST | Media library + upload | Admin | PostgreSQL + **Admin GraphQL** files | None | Unmeasured | Admin | NO | none | — | — |
| `/api/cms/collection-products` | GET | Picker products | Admin | **Admin GraphQL** | None | Unmeasured | Admin | PRIVATE Redis only if needed | Redis optional, shop-scoped | 15–30s | — |
| `/api/ota/*` | * | OTA dashboard | Admin | DB + Vercel blob | private no-cache on blobs | Unmeasured | Admin/sensitive | NO | none | — | — |
| `/hot-updater/*` | * | Mobile OTA + CLI | Public / management token | DB + blob | private no-cache | Unmeasured | Mixed/sensitive | NO public CF | none | — | — |
| `/app`, `/app/*` | GET/POST | Embedded admin UI | Admin | session + DB | Must stay uncached | Unmeasured | Admin | NO | none | — | — |
| `/auth/*` | * | OAuth | Shopify | sessions | NO | — | Sensitive | NO | none | — | — |
| `/webhooks/*` | POST | Shopify webhooks | HMAC | invalidation | NO | — | Sensitive | NO | none | — | Triggers Redis prefix delete |
| `/pages/:slug` | GET | HTML preview | (route) | CMS HTML | Not public JSON API | — | Preview | NO CF “cache everything” | none | — | — |

**Does not exist:** `GET /api/settings`, `/api/shopify/products`, `/api/upsells`, `/api/config`, `/api/storefront/*`, Next.js API routes.

---

## Current performance

### Measured

| Endpoint | Cache state | Response time |
|----------|-------------|---------------|
| `GET /cms/settings` (production URL) | Unknown (headers not captured) | **Not timed.** Body retrieved successfully; includes `cacheTtlSeconds: 300`. |

### Not measured (required before claiming 10ms)

From a client near the expected users (e.g. India) and from the VPS:

```text
Endpoint | Cache State | Response Time
---------|-------------|---------------
/cms/settings | Origin MISS (X-Cache:MISS, cf DYNAMIC or MISS) | TBD
/cms/settings | Redis HIT (X-Cache:HIT, cf DYNAMIC) | TBD
/cms/settings | Cloudflare HIT (cf-cache-status:HIT) | TBD — only this may approach ~10ms
/cms/pages | same | TBD
/graphql GET sha256 | Shopify MISS vs Redis vs CF | TBD
```

Use `curl -w` for DNS (`time_namelookup`), TLS (`time_appconnect`), TTFB (`time_starttransfer`), total. Read `cf-cache-status`, `Age`, `X-Cache`, `X-Proxy-Duration-Ms`, `Server-Timing` (`l1`, `l2`, `shopify`/`origin`).

**Realistic targets (not promises):**

| Layer | Typical if healthy |
|-------|-------------------|
| Cloudflare HIT | Single-digit to low tens of ms at nearby PoP |
| Origin L1 HIT | Sub-ms compute; **client still pays TLS+RTT to US origin** unless CF caches |
| Origin Redis HIT | ~1–5ms Redis if co-located + Node; client TTFB = RTT + that |
| Shopify MISS | Often 200–800ms+ depending on query and Shopify |

---

## Redis findings

| Topic | Finding |
|-------|---------|
| Client | Single `ioredis` connection, lazy singleton |
| Mandatory? | No — degrades to L1 |
| Pool | One TCP connection (not a pool); fine for this process model |
| Per-request connect? | No |
| Serialization | JSON envelopes (`__swr`, `exp`, `staleUntil`) |
| TTL | Redis EX = TTL+SWR seconds |
| Invalidation | `DEL` + `SCAN MATCH prefix*` |
| Issues | SCAN on large keyspaces can be slow under “clear all”; `pq:` and `rl:` share the instance — **namespace-aware delete required** |
| Unused | `catalog:v1:*` helpers; `config.cache.*` TTLs unused by `withCache` (GraphQL/CMS all use `SHOPIFY_GRAPHQL_CACHE_TTL`) |
| Coalescing | In-process `inFlight` + optional Redis lock (`distributed: true` on Storefront only) |

---

## Cloudflare findings

| Topic | Finding |
|-------|---------|
| In-repo config | Documentation only (`docs/cloudflare-edge-cache.md`). No Workers, no Terraform. |
| Origin headers | `Cache-Control: public, max-age={ttl}, s-maxage={ttl}, stale-while-revalidate={swr}` on cacheable GET |
| `CDN-Cache-Control` | Not used |
| `ETag` / `Last-Modified` | Not used |
| Cache key | Default URL including query (`shop`, `sha256`, `variables`, `cache`) |
| Limitation | **No Cache-Tag / surrogate-key in app.** Targeted CF purge = **exact URLs or prefixes** via CF API, or wait for TTL. |
| Provider code | `NoopCdnProvider` — Redis invalidation does **not** purge edge |
| Risk | Hostname-wide Cache Everything would cache `/app` sessions — docs correctly forbid this |
| POST `/graphql` | `runAndRespond` sets **public Cache-Control even when `cacheable: false`**. If a broad CF rule appears, POST responses could be cached incorrectly. **Fix in implementation phase.** |
| `?cache=bypass` | Separate URL; CF could cache a bypass fill independently |

---

## Shopify GraphQL findings

### Storefront API (public gateway)

| Item | Detail |
|------|--------|
| API | Storefront GraphQL `https://{domain}/api/{version}/graphql.json` |
| Token | Env public Storefront token (server-added) |
| Calling route | `GET/POST /graphql` → `executeStorefrontRequest` |
| Queries | **Client-supplied** (any query the token allows). Registered examples: `ProductsByCollectionId`, `ProductByHandle` in `app/lib/persisted-queries.ts` |
| Variables | Client JSON; hashed into Redis key |
| Response size | Full Shopify body cached (can be large if `first: 250`) |
| Latency | Unmeasured; `Server-Timing` `shopify;dur=` on origin |
| Cacheability | Safe for **catalog** queries. **Do not** cache customer/cart/checkout if those queries are ever allowed; today CORS `*` + public cache assumes catalog-only. Prefer `GRAPHQL_REQUIRE_PERSISTED_QUERIES` for production lock-down. |
| Errors | Not cached (`shouldCacheGraphqlResponse`) |

### Admin API GraphQL (not public-cacheable)

| Query / mutation | Service | Route |
|------------------|---------|--------|
| `CmsCollectionProducts` | `shopify-collections.server.ts` | `/api/cms/collection-products` |
| `LIST_FILES_QUERY`, `FILE_STATUS_QUERY`, `STAGED_UPLOADS_MUTATION`, `FILE_CREATE_MUTATION` | `shopify-files.server.ts` | `/api/cms/media` |

### REST

No Shopify REST Admin catalog proxy. Files use Admin GraphQL.

### Optimization (later, after timing)

- Gateway caches **entire** Shopify JSON — cannot drop fields without breaking the transparent contract (`docs/graphql-gateway-contract.md`).
- Clients should use **persisted GET + tight `first`**.
- Cache warmer (`GRAPHQL_WARM=1`) uses a **different** collection query (`first: 250`, extra `pageInfo`) than the demo SHA-256 query — warms a **different Redis key**.
- Admin `listImages` can N+1 page through Files API — admin-only.

---

## Public Storefront key

| | |
|--|--|
| Storage | Environment (`SHOPIFY_STOREFRONT_ACCESS_TOKEN`) |
| Domain | `SHOPIFY_STOREFRONT_DOMAIN` (single shop for `/graphql`) |
| Hardcoded? | No |
| Exposed to client? | **Intentionally not.** Proxy adds header server-side. |
| Correct handling | Treated as **server config**, not Admin secret. Shopify Storefront tokens are designed to be public if used in a theme; this app still keeps it off the wire to the native app. |
| Usage | `getStorefrontConfig` / `callStorefrontWithProtection` only |

---

## Cache key strategy (keep / extend)

Prefix with shop/domain. Never global `settings`.

```text
shopify:graphql:storefront:{myshopify-domain}:{sha25616(query+vars)}
cms:pages:{shop}:list
cms:pages:{shop}:slug:{slug}
cms:settings:v3:{shop}
catalog:v1:{storeId}:product:{handle}          # reserved
pq:{sha256}                                    # APQ map — global
```

Optional version: CMS settings already uses `v3`. GraphQL keys have no `vN` — bumping structure should change prefix (`shopify:graphql:v2:…`) rather than mixing envelopes.

**Clear-all** must be application-scoped, e.g. delete prefixes:

- `shopify:graphql:storefront:`
- `cms:pages:`
- `cms:settings:`
- `catalog:v1:`

**Not** `FLUSHALL`, **not** `rl:*` (rate limits), **not** necessarily `pq:*` (APQ).

**Clear store:** `cms:*:{shop}:*` + `shopify:graphql:storefront:{shop}:`  
**Clear settings:** `cms:settings:v3:{shop}`  
**Clear product:** storefront GraphQL prefix (all query hashes) + unused catalog prefix  
**Clear upsell:** **N/A** — no upsell cache. Omit or no-op until such API exists.

---

## TTL matrix (configurable later; env exists only as global GraphQL TTL today)

| API type | Suggested TTL | SWR | Notes |
|----------|---------------|-----|--------|
| Public settings | 30–60s | 60–120s | Merchants expect tab/cart changes quickly; today 300s + no CF purge |
| CMS pages | 30–60s | 60–120s | Invalidate on save already (Redis) |
| Storefront collection/product GET | 30–300s | = TTL | Webhooks should invalidate; **webhooks not in TOML** |
| Static/persisted query registration | n/a | — | `pq:`  (long TTL in code) |
| Admin APIs | no public cache | — | |
| OTA / hot-updater | no public cache | — | |
| Analytics | n/a | — | none |

Admin should eventually set Redis on/off, CF on/off, default TTL, SWR, per-route TTL. **Missing setting must not 500 the API** (already true: TTL env defaults).

---

## Cache flow (validated against code)

Public GET (intended):

```text
Client
  → Cloudflare (HIT → return; only if Cache Rule Eligible)
  → Node
      → L1 HIT → JSON + Cache-Control (CF may store)
      → L2 Redis HIT → promote L1 → JSON
      → MISS → Postgres or Shopify → L1 + async Redis SET → JSON
```

POST `/graphql`: skip CF; still use Redis.

Admin: no this flow.

---

## Cache headers design

**Public GET success:** keep `public, max-age, s-maxage, stale-while-revalidate`. Optionally add `CDN-Cache-Control` later if browser TTL should be shorter than edge.

**Public errors / 404 page:** already `no-store` for shop missing and page 404.

**POST /graphql, admin, OTA, webhooks, auth:** `private, no-store` (fix POST GraphQL).

**Do not** set public cache on personalized Shopify (`customer`, cart, checkout) if added later.

---

## Invalidation design

| Mutation | Redis | Cloudflare (not implemented) |
|----------|-------|------------------------------|
| `upsertShopSettings` | `cms:settings:v3:{shop}` | Purge `/cms/settings` (+ `?shop=` variants) |
| Page create/update/delete | `cms:pages:{shop}:*` | Purge `/cms/pages` and `/cms/pages/{slug}` |
| Product/collection webhook | `shopify:graphql:storefront:{shop}:*` | Cannot purge every `?sha256&variables` cheaply without tags — **limitation**: rely on TTL or purge `/graphql*` (broad) |
| Admin cache clear | prefix deletes above | Same URL/prefix purge |

**Gap:** `shopify.app.toml` does not subscribe `products/*` or `collections/update`. Route files exist; they likely never run in production until TOML (or Partner dashboard) registers them.

---

## Non-cache bottlenecks (do not “optimize blindly”)

| Area | Note |
|------|------|
| Shopify MISS | Dominates `/graphql` without cache |
| India ↔ US origin | CF HIT is the only way to ~10ms for users in India |
| `checkGraphqlIpLimit` Redis INCR | Extra Redis RTT on **every** `/graphql` even L1 HIT |
| Transparent GraphQL | Cannot shrink Shopify payload server-side without breaking clients |
| Admin Files list | Pagination loop |
| Duplicate settings in `/cms/settings` JSON | `bottomTab` / `homePage` / `Cart` repeated inside `settings` — larger cache objects |
| `cache=bypass` / `refresh` | Public query params — abuse + extra Shopify load |

---

## Redis performance (eval)

- Connection reuse: **yes**
- Co-located Redis: required for low L2; unmeasured
- JSON stringify of large GraphQL: CPU + memory; compression not used (defer until measured)
- Fail-open: good

---

## Cloudflare performance (eval)

- Do **not** add a Worker unless Cache Rules fail
- Need Cache Rule from `docs/cloudflare-edge-cache.md` or edge stays `DYNAMIC`
- HTTP/2/3, Brotli: zone defaults; not in app
- Query string is required in cache key for GraphQL

---

## Security review

**Never publicly cache:** sessions, Admin GraphQL, OTA management, tokens, customer data.

**Tenant isolation:**

- CMS keys include shop domain. `?shop=` lets a client request **another shop’s published CMS** if that shop exists in the same DB (intentional multi-tenant public read).
- `/graphql` is **one env shop** — cannot serve Store B catalog as Store A via query (token/domain fixed). Different `variables` still same shop.
- Cross-store Redis leak: **low** if prefixes include shop; **high** if someone `FLUSHDB` or deletes `shopify:graphql:storefront:` without shop suffix.

**Open GraphQL + CORS `*`:** any site can query the Storefront token’s data through this gateway (same as exposing Storefront). Rate limits + optional persisted-query-only mitigate abuse, not confidentiality of public catalog.

**POST Cache-Control public:** CDN misconfiguration risk.

---

## Admin cache settings + cache clear (requirements, not implemented)

Fit into **existing** `app.settings.tsx` (Polaris `s-*` components), not a new settings system. Persist new fields on `ShopSettings` (PostgreSQL) **or** env until a migration is approved. Fallback: current env TTL defaults.

**Configuration (future):** Redis on/off, Cloudflare on/off, default TTL, SWR, strategy. Changing TTL should **not** flush Redis.

**Management (future):** Clear all (app prefixes), clear store, settings, product (GraphQL prefix). **No upsell** until that API exists. Confirm dialogs. Server action with `authenticate.admin`. Log table **without** secrets. Partial success if CF purge fails.

**Warming:** lazy rebuild on next request (already). Do not hit all APIs after clear. `GRAPHQL_WARM` is opt-in and currently misaligned with demo APQ query.

---

## Recommended cache strategy

Use **Cloudflare + Redis** only for:

- `GET /cms/settings`
- `GET /cms/pages`
- `GET /cms/pages/:slug`
- `GET /graphql` (catalog / APQ)

Use **Redis only** for `POST /graphql`.

Use **no public cache** for `/api/*`, `/app`, `/auth`, `/webhooks`, `/hot-updater`.

Do **not** rebuild a second Redis module.

---

## Recommended implementation plan (small tasks, after this audit is approved)

1. **Measure** production headers + `curl -w` (CF vs `X-Cache`) from India and from origin; fill the latency table.
2. **Fix** POST `/graphql` `Cache-Control: no-store`; consider ignoring `cache=bypass` on GET for anonymous clients or not advertising it on CF-cached URLs.
3. **Register** product/collection webhooks in `shopify.app.toml` if GraphQL freshness on catalog updates is required.
4. **Cloudflare:** confirm Cache Rule live (document `cf-cache-status`); implement real `CdnCacheProvider` URL purge using CF API tokens (server-only).
5. **TTL:** wire `ShopSettings` or env per-route TTL into `withCache` / `publicCachedJson` without breaking fallbacks.
6. **Admin UI:** Cache Configuration + Cache Management on existing Settings; `isRedisAvailable()` for status; confirmation + logs model.
7. **Clear APIs:** wrap existing `invalidateCms*`, `invalidateStorefrontGraphqlCache`, `cacheDelByPrefix` — never flush shared Redis.
8. Optionally enable `GRAPHQL_REQUIRE_PERSISTED_QUERIES`; align warmer query with APQ hashes.
9. Re-measure; only then discuss ~10ms on **CF HIT** paths.

---

## Audit task status

| Task | Status |
|------|--------|
| 1 API inventory | Done |
| 2 Public/private/sensitive | Done |
| 3 Shopify GraphQL | Done |
| 4 Storefront token | Done |
| 5 Redis | Done — reuse `redis-cache.server.ts` |
| 6 Cloudflare | Done — docs + Noop purge |
| 7 Measure | **Partial** — settings body live; timings blocked in audit environment |
| 8–20 Design | Done in this doc |
| 21 Report | This file + `agent.md` |
| Cache-clear UI | **Designed only** — do not implement until audit validated |
