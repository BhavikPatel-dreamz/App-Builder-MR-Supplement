# Cloudflare cache setup — all public GET APIs

Origin already sends this on cacheable GET responses:

```http
Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=300
```

Cloudflare ignores that until a **Cache Rule** marks the URL **Eligible for cache**. Without the rule you see `cf-cache-status: DYNAMIC` (Redis `X-Cache` can still be HIT).

Do **not** turn on hostname-wide “Cache Everything”. That would cache `/app` admin HTML and logged-in Shopify sessions.

---

## 1. What to cache vs what to skip

### Cache these (native app, GET only)

| What | URL | Notes |
|------|-----|--------|
| GraphQL | `https://appbuilder.dreamzapps.com/graphql` | GET `?sha256=` or `?query=` |
| Page list | `https://appbuilder.dreamzapps.com/cms/pages` | |
| One page | `https://appbuilder.dreamzapps.com/cms/pages/{slug}` | |
| Settings + bottom tabs | `https://appbuilder.dreamzapps.com/cms/settings` | |

Query strings (`sha256`, `variables`, `shop`, `cache`) are part of the cache key. Different variables = different edge entries.

### Never cache these

| Path | Why |
|------|-----|
| `/app`, `/app/*` | Embedded Shopify admin |
| `/auth`, `/auth/*` | OAuth |
| `/api/*` | Admin APIs (session cookies) |
| `/webhooks/*` | Must always hit origin |
| `/pages/*` | HTML preview, not the native JSON API |
| **POST** `/graphql` | Registers queries; not edge-cacheable |

---

## 2. Cloudflare Dashboard — create the cache rule

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Open the **zone** that serves `appbuilder.dreamzapps.com`  
   (the domain in Cloudflare, often `dreamzapps.com`).
3. Left sidebar: **Caching** → **Cache Rules**.
4. **Create rule**.
5. **Rule name:** `Cache CMS + GraphQL GET`.
6. Under **When incoming requests match**:
   - Choose **Custom filter expression** (not “All incoming requests”).
   - Click **Edit expression** (or Expression Builder).
   - Paste:

```txt
(http.host eq "appbuilder.dreamzapps.com" and http.request.method eq "GET" and (
  starts_with(http.request.uri.path, "/graphql") or
  starts_with(http.request.uri.path, "/cms/pages") or
  http.request.uri.path eq "/cms/settings"
))
```

   If you prefer the field UI instead of one expression:

   | Field | Operator | Value |
   |-------|----------|--------|
   | Hostname | equals | `appbuilder.dreamzapps.com` |
   | AND Request Method | equals | `GET` |
   | AND (URI Path | starts with | `/graphql` |
   | OR URI Path | starts with | `/cms/pages` |
   | OR URI Path | equals | `/cms/settings` ) |

7. Under **Then**:

   | Setting | Value |
   |---------|--------|
   | Cache eligibility | **Eligible for cache** |
   | Edge TTL | **Use cache-control header** (uses origin `s-maxage=300`) |
   | Browser TTL | **Respect origin TTL** |
   | Origin Cache-Control | **On** (respect `Cache-Control` from Node) |
   | Cache key | Default (include query string — required for `?sha256=` / `?variables=`) |

8. **Place** this rule **above** any “Bypass cache for everything” rules if those exist.
9. **Deploy**.

Wait 10–30 seconds, then test (section 5).

---

## 3. Optional: bypass POST (safety)

If you already have a broad “cache everything” rule, add a **higher-priority** rule:

**Name:** `Bypass POST`

**Expression:**

```txt
(http.host eq "appbuilder.dreamzapps.com" and http.request.method eq "POST")
```

**Then:** Cache eligibility = **Bypass cache**.

---

## 4. Optional: bypass admin (safety)

**Name:** `Bypass admin and APIs`

```txt
(http.host eq "appbuilder.dreamzapps.com" and (
  starts_with(http.request.uri.path, "/app") or
  starts_with(http.request.uri.path, "/auth") or
  starts_with(http.request.uri.path, "/api") or
  starts_with(http.request.uri.path, "/webhooks")
))
```

**Then:** Bypass cache.

Rule order (top = first match, typical):

1. Bypass POST  
2. Bypass admin and APIs  
3. Cache CMS + GraphQL GET  

---

## 5. Verify each route

Run **twice**. First = `MISS` (or `DYNAMIC` if the rule is missing). Second = `HIT`.

```bash
# Settings
curl -sS -D - -o /dev/null 'https://appbuilder.dreamzapps.com/cms/settings' \
  | grep -iE 'HTTP/|cf-cache-status|cache-control|x-cache'

# Pages list
curl -sS -D - -o /dev/null 'https://appbuilder.dreamzapps.com/cms/pages' \
  | grep -iE 'HTTP/|cf-cache-status|cache-control|x-cache'

# One page (replace SLUG)
curl -sS -D - -o /dev/null 'https://appbuilder.dreamzapps.com/cms/pages/SLUG' \
  | grep -iE 'HTTP/|cf-cache-status|cache-control|x-cache'

# GraphQL persisted query
curl -sS -D - -o /dev/null --get 'https://appbuilder.dreamzapps.com/graphql' \
  --header 'accept: application/json' \
  --data-urlencode 'sha256=6fa67e8cb153fec67b0fbab3bb9ccc3704997da5287f7ee9faa0a55006bd845d' \
  --data-urlencode 'variables={"id":"gid://shopify/Collection/352562380953","first":2}' \
  | grep -iE 'HTTP/|cf-cache-status|cache-control|x-cache'
```

### How to read headers

| Header | Meaning |
|--------|---------|
| `cf-cache-status: DYNAMIC` | Rule not matching — Cloudflare is not caching |
| `cf-cache-status: MISS` | Rule works; first fill of the edge |
| `cf-cache-status: HIT` | Served from Cloudflare (India/Mumbai edge if that is the PoP) |
| `cf-cache-status: EXPIRED` / `STALE` | Edge revalidating; still OK |
| `cf-cache-status: BYPASS` | A bypass rule or cookie/`Cache-Control: private` skipped cache |
| `X-Cache: HIT` | Redis on **your VPS** (works even when CF is DYNAMIC) |
| `X-Cache: MISS` | Origin fetched DB/Shopify |

You want **both**: `cf-cache-status: HIT` and origin `X-Cache: HIT` on repeat GETs.

If CF stays `DYNAMIC` after deploy:

- Hostname in the rule must be exactly `appbuilder.dreamzapps.com` (subdomain, not only `dreamzapps.com`).
- Method is GET (not POST).
- Rule is **Enabled**.
- **Development Mode** is off (**Caching → Configuration**).
- Orange-cloud (proxied) DNS for that hostname, not DNS-only grey cloud.

---

## 6. Purge after CMS/settings publish

Redis is cleared on save. Cloudflare can still serve old JSON for up to **300 seconds**.

**Caching → Configuration → Purge Cache → Custom purge:**

```text
https://appbuilder.dreamzapps.com/cms/settings
https://appbuilder.dreamzapps.com/cms/pages
https://appbuilder.dreamzapps.com/cms/pages/*
https://appbuilder.dreamzapps.com/graphql*
```

Or wait 5 minutes.

---

## 7. Native app URLs (after the rule is live)

```text
GET https://appbuilder.dreamzapps.com/graphql?sha256=...&variables=...
GET https://appbuilder.dreamzapps.com/cms/pages
GET https://appbuilder.dreamzapps.com/cms/pages/{slug}
GET https://appbuilder.dreamzapps.com/cms/settings
```
