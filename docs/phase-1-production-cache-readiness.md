# Phase 1 — Production Cache Readiness Verification

**Date:** 2026-09-21  
**Scope:** Verification only. No application, DNS, Cloudflare, Redis, cron, or Shopify config changes.  
**Evidence machine (this session):** Cursor/agent network, not dd-106.  
**Hostname tested:** `https://appbuilder.dreamzapps.com`

Labels: **VERIFIED** (this session or same-day dd-106 curls already captured), **NOT VERIFIED**, **INFERRED**.

---

## 1. Executive Summary

Production catalog traffic is **Cloudflare (orange-cloud) → Vercel (`*1::iad1`) → Redis L1/L2 → Shopify Storefront** on `GET /graphql`. CMS `GET /cms/*` is on the same host. **India nginx `proxy_cache` is not in production as an API origin** (not in repo; dd-106 not inspected this session).

All five native **sha256** hashes **resolve and return `data`** (not `PersistedQueryNotFound`) — **INFERRED** APQ present in production Redis.

Anonymous `/api/cron/cache-refresh` and `/api/cron/cache-urls` return **401** as designed. Whether **Vercel Cron** itself succeeds is **NOT VERIFIED** (no dashboard). Historical cron 401 from `vercel-cron/1.0` is **Unknown** if still occurring after the in-repo auth change.

**~20ms India HIT** is **not** the current path. This session: CF HIT reused HTTP/2 TTFB **~115ms** (`HKG`). Same-day dd-106: **~104ms** (`SIN`). Origin GraphQL MISS: **TTFB ~2.9s** (`l2` 197ms + `shopify` 1691ms).

---

## 2. Current Production Architecture

**VERIFIED (Production HTTP + DNS):**

```text
Client
  → DNS A 104.21.54.119, 172.67.138.131  (Cloudflare anycast)
  → Cloudflare (server: cloudflare, cf-ray, cf-cache-status)
  → Vercel (x-vercel-id: {hkg1|sin1}::iad1::…)
  → React Router 7 /graphql and /cms/*
```

| Check | Result | Evidence |
|-------|--------|----------|
| Production hostname | `appbuilder.dreamzapps.com` | `shopify.app.toml` + live HTTP |
| DNS | Cloudflare IPs, empty CNAME (flattened A) | `dig` |
| Cloudflare proxy | **Yes** (orange-cloud) | `server: cloudflare` |
| Vercel | **Yes** | `x-vercel-cache`, `x-vercel-id` |
| Intake region | **hkg1** or **sin1** (this session) | `x-vercel-id` |
| Function/origin | **iad1** (US) | `x-vercel-id` `::iad1::` |
| GET `/graphql` | 200 JSON | curl |
| GET `/cms/settings`, `/cms/pages` | 200 JSON | curl |
| GET `/app` (unauthenticated) | **410** HTML | curl — **INFERRED** Shopify embed/auth, not a public API |
| GET `/api/cron/*` unauthenticated | **401** | curl |
| Redis in path | **INFERRED** when `X-Cache: HIT` without `shopify` in Server-Timing; **VERIFIED** miss path `l2` + `shopify` | headers |
| Shopify | **VERIFIED** on MISS (`server-timing: shopify;dur=1691`) | headers |

**NOT VERIFIED:** Vercel project dashboard, whether every env matches git.

Proposed path (Mobile → India nginx → CF → Vercel) **does not exist** as serving architecture.

---

## 3. Production Redis Verification

| Field | Value |
|-------|--------|
| Provider | **NOT VERIFIED** (only `REDIS_URL` in code) |
| Region | **NOT VERIFIED** |
| Environment | Production origin uses Redis **INFERRED** (`X-Cache: HIT` on GraphQL/CMS) |
| Approximate latency | **This session origin MISS:** `l2;dur=197` (Redis GET miss round-trip **VERIFIED** in Server-Timing). **Prior same-day origin HIT:** `l2;dur=397–405` (audit; **not re-measured** as a dedicated HIT this session). |
| Shared / isolated | **NOT VERIFIED** |
| Credentials | **Not exposed** |

The **~397–405ms** figure was **origin Redis HIT** (`Server-Timing l2`) on 2026-09-21 earlier, with `X-Cache: HIT`. It is **not** CF HIT time. This session did **not** capture a fresh origin-only Redis HIT `l2` on a CF-bypassed URL.

---

## 4. APQ Verification

Direct Redis `GET pq:{hash}`: **NOT VERIFIED** (no Redis access).

| Hash (prefix) | Expected operation | HTTP result | Present? | Verified |
|---------------|--------------------|-------------|----------|----------|
| `759dff3d…` | ProductsByCollectionId | 200, `data`, no `errors` | **INFERRED present** | Production HTTP |
| `05d184d8…` | ProductsByCollection (handle) | 200, `data` | **INFERRED present** | Production HTTP |
| `22043217…` | GetProductByProductId | 200, `data` | **INFERRED present** | Production HTTP |
| `5bba4cde…` | GetProductByHandle | 200, `data` | **INFERRED present** | Production HTTP |
| `d7d84801…` | GetProductsByIds | 200, `data` | **INFERRED present** | Production HTTP |

Bodies **not printed**. `PersistedQueryNotFound` was **not** observed for these hashes.

---

## 5. Native GET GraphQL Verification

**Native APK/source in this workspace:** **NOT VERIFIED** (hashes/URLs from prior native snippets + this HTTP probe).

**VERIFIED:** production accepts **GET** `/graphql?sha256=&variables=` for all five hashes. Method GET, URL-encoded JSON variables. `after:null` vs omitted `after` both **200 + data** for collection ID (different CF objects — see §18).

Cache-Control on GET: `public, max-age=300, s-maxage=300, stale-while-revalidate=600` plus `cdn-cache-control` **VERIFIED**.

---

## 6. Cloudflare Verification

**VERIFIED:** GET `/graphql` and `/cms/*` participate in CF cache (`HIT` / `MISS` / `EXPIRED`). Query string is in the cache identity (collection `after:null` vs canonical `first`+`id` order had **different** `cf-cache-status`/`age` in the same minute).

| Header | Observed |
|--------|----------|
| CF-Cache-Status | HIT, MISS, EXPIRED |
| CF-Ray | `…-HKG`, `…-SIN` (this session) |
| Cache-Control | max-age=300, s-maxage=300, SWR=600 |
| CDN-Cache-Control | present |
| Age | 0 on MISS/EXPIRED fill; 875 on one STALE Vercel object |
| ETag | **not observed** in grep this session |

POST `/graphql` not retested this session. `/api/cron` `cf-cache-status: DYNAMIC` **VERIFIED**.

**Do not change CF** (this task).

---

## 7. dd-106 / India Infrastructure Verification

| Question | Result |
|----------|--------|
| What dd-106 does | **NOT VERIFIED this session** (no SSH). **Prior same-day:** Ubuntu user `ubuntu@dd-106` ran `curl` to production. |
| nginx installed / proxy_cache / serving catalog | **NOT VERIFIED** |
| Only warm/curl | **INFERRED** from repo (`scripts/warm-edge.sh`) + prior curls |
| Public IP / DNS for catalog | Production DNS is **Cloudflare**, not a documented dd-106 A record **VERIFIED** via `dig` |
| Physically in India | **NOT VERIFIED** (hostname convention only) |
| nginx as API origin | **NOT CURRENT** |

---

## 8. India → Production Latency

**This session = agent PoP HKG/SIN, not a guaranteed India metro.**

**Same-day dd-106 (historical VERIFIED in chat, not repeated now):** CF HIT r1 ~345ms, r2 ~104ms, `cf-ray` SIN.

### This session

| Test | URL type | HTTP | CF-Ray | CF-Cache-Status | Vercel | TTFB | Notes |
|------|----------|------|--------|-----------------|--------|------|-------|
| A Product HIT | product ID GET | 200 | HKG | MISS (first) | MISS | n/a isolated | `X-Cache: HIT` origin Redis **INFERRED** |
| B Collection HIT | collection ID `after:null` second of `--next` | 200 | HKG | **HIT** | — | **r2 0.115s** | r1 EXPIRED 0.997s |
| C Product MISS | products-by-ids 1 id | 200 | HKG | MISS | MISS | **2.90s** | `X-Cache: MISS`, shopify 1691ms |
| D Collection MISS/EXPIRED | collection `after=null` first | 200 | SIN | EXPIRED | MISS | measured earlier ~0.4–1s class | Redis `X-Cache: HIT` |
| E Redis HIT | Server-Timing on origin | — | — | — | — | **l2 197ms** on miss path | HIT l2 **not isolated this session** |
| F Shopify | same as C | — | — | — | — | **shopify 1691ms** | VERIFIED |

CMS settings: CF EXPIRED, `X-Cache: HIT`, `x-vercel-id: hkg1::iad1`.

---

## 9. HTTP/2 / Connection Reuse

**VERIFIED this session (`--next`):**

- HTTP/2 (`http=2`)
- r1 EXPIRED TTFB **0.997s**
- r2 HIT TTFB **0.115s** same `cf-ray` prefix colo **HKG**

**Cold vs warm:** matches audit pattern (handshake vs reuse). Exact 345/104 was **dd-106/SIN** (historical).

HTTP/3: **NOT VERIFIED** (curl used HTTP/2).

Mobile keep-alive: **NOT VERIFIED**.

---

## 10. Vercel Cron Verification

| Item | Result | Evidence |
|------|--------|----------|
| `vercel.json` | `*/5` `/api/cron/cache-refresh` | Repository |
| `/api/cron/cache-urls` | exists in repo | Repository |
| Anonymous GET refresh | **401** `{"error":"Unauthorized"}` | Production HTTP |
| Anonymous GET urls | **401** | Production HTTP |
| Cron running / last success / last fail | **NOT VERIFIED** | No Vercel dashboard |
| `CRON_SECRET` / `CACHE_CRON_SECRET` | **NOT VERIFIED** in env (values not read) | — |
| Historical 401 `vercel-cron/1.0` | Repo **allows** `x-vercel-cron` + UA; **production deploy of that fix: NOT VERIFIED** | Repo vs unknown deploy |
| Status of 401 bug | **Unknown** | |

---

## 11. 2,200 Warm Object Verification

**Do not warm in this task.**

| | Configured (repo defaults) | Actual Shopify count | Production list |
|--|----------------------------|----------------------|-----------------|
| Collections | `CACHE_WARM_MAX_COLLECTIONS` default **100** | **NOT VERIFIED** | **NOT VERIFIED** (`/api/cron/cache-urls` 401) |
| Products | `CACHE_WARM_MAX_PRODUCTS` default **1000** | **NOT VERIFIED** | **NOT VERIFIED** |
| `CACHE_WARM_COLLECTION_FIRST` | default **10** | — | Repo |
| Env overrides in production | **NOT VERIFIED** | | |

Theoretical URLs if caps met: 100×2 + 1000×2 = **2200** plus seen `ids[]` lists. **Generation capability: CURRENT in code. Production enumeration: NOT VERIFIED.**

---

## 12. Hot/Warm/Cold Verification

**Source:** `app/lib/catalog-warm.server.ts` **VERIFIED in repository.** Production execution **NOT VERIFIED**.

| Tier | TTL write | Due / trigger |
|------|-----------|----------------|
| HOT | **600s** (10 min) | lastAccess ≤ 10 min; due if lastWarm ≥ **5 min**; mode `refresh` |
| WARM | **1800s** (30 min) | lastAccess ≤ 24h **or never accessed**; due if lastWarm ≥ **30 min**; mode `default` |
| COLD | **86400s** (1 day) | lastAccess > 24h; due if lastWarm ≥ **1 day**; mode `default` |

HTTP Cache-Control for clients/CF remains **300s** on observed production responses (separate from per-write Redis TTL).

---

## 13. 40 Jobs / 5 Minutes Verification

| | Configured | Actual production |
|--|------------|-------------------|
| Batch | `CACHE_WARM_BATCH` default **40** | **NOT VERIFIED** |
| Cron | `*/5` | Schedule in git; run success **NOT VERIFIED** |
| Concurrency | default **4** | **NOT VERIFIED** |

Math: 40 × 12/hour = 480/hour; 40 × 288/day = 11520/day **if every tick runs 40 due jobs**. Many jobs **skip Shopify** on Redis HIT (`default` mode). HOT uses `refresh` (Shopify). Retries/circuit: §14.

---

## 14. Shopify Protection Verification

**Repository VERIFIED** (`app/lib/protection/config.server.ts`, `storefront-fetch.server.ts`):

| Limit | Default |
|-------|---------|
| GraphQL IP / min | 1200 |
| Shopify miss / IP / min | 120 |
| Per cache-key miss / min | 60 |
| Global Shopify / min | 600 |
| Timeout | 15s |
| Max retries | 3 |
| 429 / 5xx / THROTTLED | retry + backoff + Retry-After |
| Circuit breaker | threshold / open ms / half-open |
| Lock wait | 250ms |

Production override env: **NOT VERIFIED**.

---

## 15. Webhook Subscription Verification

| | Route exists | TOML | Partner Dashboard | Traffic received |
|--|--------------|------|-------------------|------------------|
| app/uninstalled | Yes | **Yes** | **NOT VERIFIED** | **NOT VERIFIED** |
| app/scopes_update | Yes | **Yes** | **NOT VERIFIED** | **NOT VERIFIED** |
| products create/update/delete | **Yes** | **No** | **NOT VERIFIED** | **NOT VERIFIED** |
| collections/update | **Yes** | **No** | **NOT VERIFIED** | **NOT VERIFIED** |

---

## 16. Cache Invalidation Verification

| Layer | Product/collection change |
|-------|---------------------------|
| Redis | **CURRENT in code** if webhook runs: `invalidateStorefrontGraphqlCache` prefix delete |
| Cloudflare | **No app purge** (`NoopCdnProvider`) **VERIFIED in repo** |
| nginx | **N/A** |

CMS save: Redis CMS keys **CURRENT in code**. Production webhook delivery **NOT VERIFIED**.

---

## 17. Admin Cache Controls Verification

**CURRENT (`/app/cache`):** save TTL/SWR/warmer flags; add URL + query text; clear one URL; warm one; warm all; logs; hit/miss (Redis stats).

**MISSING:** Cloudflare purge API; nginx purge; “clear all catalog”; clear-by-product; flush Redis (correctly absent).

Admin UI live in production: **NOT VERIFIED** (embed 410 without session).

---

## 18. Cache-Key Consistency

**VERIFIED in unit tests + production HTTP:**

| Layer | Key | `after:null` vs omit | JSON key order |
|-------|-----|----------------------|----------------|
| Redis | query + canonicalize (drop nulls, sort keys) | **Same** Redis object (code + tests) | **Same** |
| Cloudflare | Full GET URL | **Different** objects **VERIFIED** (different `age` / `cf-cache-status` same minute) | **Different** if encoding differs |

Duplicate CF objects for logically identical collection page-1: **VERIFIED** as a risk.

---

## 19. 20ms Feasibility

| Path | Measured | Source |
|------|----------|--------|
| This session → CF HIT (reuse) | **~115 ms** | curl `--next` HKG |
| dd-106 → CF HIT (reuse, same day) | **~104 ms** | prior SIN |
| This session → CF EXPIRED/origin | **~1.0–2.9 s** | curl |
| Origin Redis L2 on MISS | **197 ms** | Server-Timing |
| Origin Redis HIT l2 | **~397–405 ms** | earlier same day, not re-run |
| Shopify on MISS | **1691 ms** | Server-Timing |
| India nginx HIT | **not applicable** | not deployed |

**PROPOSED ~20ms** requires a cache **in/near the client’s India network** (local nginx or CF colo `BOM`/`MAA`/`DEL` with keep-alive). **CURRENT CF HIT to SIN/HKG cannot be assumed to be 20ms.**

---

## 20. Blockers

| Level | Item |
|-------|------|
| **BLOCKER** | Redis **region/provider unknown** — cannot plan India vs US Redis |
| **BLOCKER** | Vercel Cron **success unknown**; anonymous 401 expected; platform cron **Unknown** |
| **BLOCKER** | dd-106 **nginx/API role unknown**; cannot design India cache on an unverified host |
| **HIGH** | CF **EXPIRED** → **iad1** multi-second (observed) |
| **HIGH** | CF PoP **SIN/HKG** for tests, not BOM |
| **HIGH** | Catalog webhooks **not in TOML**; production delivery unknown |
| **HIGH** | Duplicate CF keys `after:null` vs canonical |
| **MEDIUM** | 2,200 object **counts not pulled** from production (cron-urls 401) |
| **MEDIUM** | Native app keep-alive **unknown** |
| **LOW** | HTTP/3 unknown |

---

## 21. Required Decisions Before Implementation

1. Is **~20ms** mandatory, or is **~100ms CF HIT** acceptable?  
2. Will catalog API stay on `appbuilder.dreamzapps.com` or a **new India hostname**?  
3. Confirm Redis region and cron logs in Vercel.  
4. Confirm dd-106: curl-only vs future nginx.  
5. Subscribe product/collection webhooks or accept TTL-only freshness.  
6. CF Edge TTL / serve-stale (ops, not this task).

---

## 22. Recommended Phase 2

**Design and approve** India cache architecture **after** blockers 1–4. Do **not** implement nginx/DNS until Redis region, cron health, and dd-106 role are known.

---

## 23. Evidence / Commands / Measurements

Commands (this session): `dig +short appbuilder.dreamzapps.com`; `curl` GET `/cms/settings`, `/cms/pages`, five `/graphql?sha256=` examples, `/api/cron/cache-refresh`, `/api/cron/cache-urls`, `/app`; `--next` collection URL.

Example origin MISS:

```text
server-timing: l2;dur=197, shopify;dur=1691, total;dur=1888
x-cache: MISS
x-vercel-id: hkg1::iad1::…
cf-cache-status: MISS
cf-ray: …-HKG
ttfb=2.901768
```

Example CF HIT reuse:

```text
r1 cf-cache-status: EXPIRED ttfb=0.996507
r2 cf-cache-status: HIT ttfb=0.114912
cf-ray: …-HKG
```

---

*No production or application behavior was changed.*
