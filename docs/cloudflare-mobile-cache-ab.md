# Cloudflare cache — mobile APIs on `ab.mrsupplement.com.au` only

Cache rules for the **native app** on this subdomain only. They do **not** apply to other hostnames in the `mrsupplement.com.au` zone.

| Role | Host |
|---|---|
| App + mobile API (this doc) | `ab.mrsupplement.com.au` |
| Storefront (not these rules) | `mr-supplement-2.myshopify.com` / shop domain |

## Important: proxy vs Admin iframe

Cloudflare edge cache only works when the DNS record is **Proxied** (orange cloud).

Shopify Admin embeds `/app` in an iframe. **Bot Fight / Managed Challenge** on that host breaks the iframe (`X-Frame-Options: SAMEORIGIN` on the challenge page → “refused to connect”).

For this subdomain to do **both** Admin + mobile cache:

1. DNS `ab` → `A` `3.87.24.231` → **Proxied** (orange)
2. SSL/TLS → **Full (strict)** (Caddy has a real cert)
3. Security → Bot Fight / Super Bot Fight → **Off** for this zone (or a WAF skip below)
4. Cache Rules below (host-scoped to `ab` only)

If Admin breaks again, temporarily set DNS to **DNS only** (grey). Edge cache stops until proxy is back on; origin Redis cache still works.

---

## 1. What the mobile app calls (cache these)

Base: `https://ab.mrsupplement.com.au`

| API | Path | Method |
|---|---|---|
| GraphQL (hash or full query) | `/graphql` | **GET** |
| CMS page list | `/cms/pages` | GET |
| One CMS page | `/cms/pages/{slug}` | GET |
| CMS settings / tabs | `/cms/settings` | GET |
| Product reviews | `/reviews/get` | GET |

Query strings (`sha256`, `variables`, `shop`, `product_id`, …) are part of the cache key. Different variables = different edge objects.

Origin already sends roughly:

```http
Cache-Control: public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800
```

Without a Cache Rule, Cloudflare still shows `cf-cache-status: DYNAMIC` even when origin Redis is HIT.

## 2. Never cache on this host

| Path | Why |
|---|---|
| `/app`, `/app/*` | Embedded Shopify Admin |
| `/auth`, `/auth/*` | OAuth |
| `/api/*` | Session / admin APIs |
| `/webhooks/*` | Must hit origin |
| `/hot-updater/app-version/*`, `/hot-updater/fingerprint/*` | OTA update checks must be fresh |
| **POST** `/graphql` | Register / mutate — not edge-cacheable |
| `/` | Public redirect / landing |

Optional later: cache `/hot-updater/files/*` (content-addressed zips) with a separate long-TTL rule. Skip until OTA is stable.

---

## 3. Dashboard — create rules for this subdomain only

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select the zone **`mrsupplement.com.au`** (not a different domain)
3. **Caching** → **Cache Rules** → **Create rule**

Every expression below starts with:

```txt
http.host eq "ab.mrsupplement.com.au"
```

That is what keeps the rule off `www`, apex, and any other subdomain.

### Rule A — Cache mobile GET APIs (create first)

**Name:** `ab — cache mobile GET`

**When incoming requests match** → Custom filter expression:

```txt
(http.host eq "ab.mrsupplement.com.au" and http.request.method eq "GET" and (
  starts_with(http.request.uri.path, "/graphql") or
  starts_with(http.request.uri.path, "/cms/pages") or
  http.request.uri.path eq "/cms/settings" or
  http.request.uri.path eq "/reviews/get"
))
```

Field builder equivalent:

| Field | Operator | Value |
|---|---|---|
| Hostname | equals | `ab.mrsupplement.com.au` |
| AND Request Method | equals | `GET` |
| AND ( URI Path | starts with | `/graphql` |
| OR URI Path | starts with | `/cms/pages` |
| OR URI Path | equals | `/cms/settings` |
| OR URI Path | equals | `/reviews/get` ) |

**Then:**

| Setting | Value |
|---|---|
| Cache eligibility | **Eligible for cache** |
| Edge TTL | **Use cache-control header** (respects origin ~30 min) |
| Browser TTL | **Respect origin** |
| Origin Cache-Control | **On** |
| Cache key | Default (**include query string**) |

**Deploy.** Put this **above** any broad “bypass everything” rules if those exist.

### Rule B — Bypass Admin / auth / OTA checks (higher priority)

**Name:** `ab — bypass admin auth ota`

Create this rule and place it **above** Rule A (higher priority = evaluated first).

```txt
(http.host eq "ab.mrsupplement.com.au" and (
  starts_with(http.request.uri.path, "/app") or
  starts_with(http.request.uri.path, "/auth") or
  starts_with(http.request.uri.path, "/api/") or
  starts_with(http.request.uri.path, "/webhooks") or
  starts_with(http.request.uri.path, "/hot-updater/app-version") or
  starts_with(http.request.uri.path, "/hot-updater/fingerprint") or
  http.request.uri.path eq "/"
))
```

**Then:** Cache eligibility = **Bypass cache**.

### Rule C — Bypass all POST on this host

**Name:** `ab — bypass POST`

```txt
(http.host eq "ab.mrsupplement.com.au" and http.request.method eq "POST")
```

**Then:** Bypass cache.

### Rule order (top → bottom)

1. `ab — bypass admin auth ota`
2. `ab — bypass POST`
3. `ab — cache mobile GET`

---

## 4. Optional WAF skip (keeps Admin iframe working while Proxied)

**Security** → **WAF** → **Custom rules** (or Configuration Rules):

**Name:** `ab — skip challenge for admin`

```txt
(http.host eq "ab.mrsupplement.com.au" and (
  starts_with(http.request.uri.path, "/app") or
  starts_with(http.request.uri.path, "/auth") or
  starts_with(http.request.uri.path, "/api/auth")
))
```

**Action:** Skip → Bot Fight Mode / Managed Challenge / Security Level (as offered in the UI).

Or turn Bot Fight **Off** for the whole zone if you do not need it on other subdomains.

---

## 5. Verify (this host only)

```bash
# DNS must be Cloudflare IPs when Proxied (104.x / 172.x), not only 3.87.x
dig +short ab.mrsupplement.com.au

# First hit may be MISS; second should be HIT
curl -sS -D - -o /dev/null \
  'https://ab.mrsupplement.com.au/cms/settings' | tr -d '\r' | grep -iE 'cf-cache-status|cache-control|x-cache'

curl -sS -D - -o /dev/null \
  'https://ab.mrsupplement.com.au/cms/settings' | tr -d '\r' | grep -iE 'cf-cache-status|x-cache'

# GraphQL example (replace sha256/variables with a real catalog call)
curl -sS -D - -o /dev/null --get \
  'https://ab.mrsupplement.com.au/graphql' \
  --data-urlencode 'sha256=7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871' \
  --data-urlencode 'variables={"id":"gid://shopify/Collection/1","first":10}' \
  | tr -d '\r' | grep -iE 'cf-cache-status|cache-control|x-cache'

# Admin must NOT be cached / challenged
curl -sS -D - -o /dev/null \
  'https://ab.mrsupplement.com.au/app' | tr -d '\r' | grep -iE 'cf-cache-status|cf-mitigated|x-frame'
```

| Header | Good for mobile GET |
|---|---|
| `cf-cache-status: HIT` or `MISS` then `HIT` | Rule is working |
| `cf-cache-status: DYNAMIC` | Rule missing or wrong host / method |
| `cf-mitigated: challenge` | Bot challenge still on — Admin/iframe will break |
| `x-cache: HIT` | Origin Redis HIT (works even if CF is DYNAMIC) |

---

## 6. Purge (this hostname)

**Caching** → **Configuration** → **Purge Cache**:

- **Custom purge** → URLs, e.g.  
  `https://ab.mrsupplement.com.au/cms/settings`  
  `https://ab.mrsupplement.com.au/cms/pages`  
  `https://ab.mrsupplement.com.au/graphql*`  
- Or purge by hostname / prefix if your plan allows  

Do not purge the whole zone unless you mean every subdomain.

---

## 7. Mobile app base URL

Point the React Native / native clients at:

```text
https://ab.mrsupplement.com.au/graphql
https://ab.mrsupplement.com.au/cms/pages
https://ab.mrsupplement.com.au/cms/settings
```

See also [mobile-graphql-api.md](./mobile-graphql-api.md). Older docs that say `appbuilder.dreamzapps.com` are the previous host — use `ab.mrsupplement.com.au` in production.

---

## Quick checklist

- [ ] Zone = `mrsupplement.com.au`
- [ ] DNS `ab` Proxied (orange) + SSL Full (strict)
- [ ] Bot challenge off / WAF skip for `/app` + `/auth`
- [ ] Rule: host `ab.mrsupplement.com.au` + GET `/graphql` `/cms/*` `/reviews/get` → Eligible
- [ ] Bypass: `/app` `/auth` `/api` `/webhooks` OTA checks `/` POST
- [ ] Second GET shows `cf-cache-status: HIT`
- [ ] Shopify Admin iframe still loads
