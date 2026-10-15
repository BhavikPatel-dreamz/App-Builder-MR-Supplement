# GraphQL Gateway Contract — Transparent Shopify Passthrough

The `/graphql` endpoint is a **transparent Shopify Storefront GraphQL gateway**. Clients can replace:

```text
https://{shop}.myshopify.com/api/{version}/graphql.json
```

with:

```text
https://appbuilder.dreamzapps.com/graphql
```

without changing how they parse GraphQL responses.

Mobile registration, direct `GET ?query=`, and the current hash list: [mobile-graphql-api.md](./mobile-graphql-api.md).

## Response contract

Every successful or failed GraphQL response uses Shopify's JSON shape:

```json
{
  "data": { ... },
  "errors": [ { "message": "..." } ],
  "extensions": { ... }
}
```

The gateway **never** flattens, renames, or wraps fields (no `{ products: [] }`, no `{ result: { ... } }`, no REST `{ error: "..." }` for GraphQL failures).

Infrastructure metadata lives in **HTTP headers only**:

| Header | Purpose |
|--------|---------|
| `X-Cache` | `HIT`, `MISS`, `BYPASS`, `REFRESH`, `STALE` |
| `X-Proxy-Duration-Ms` | Total gateway time |
| `Server-Timing` | L1 / L2 / Shopify breakdown |
| `X-Request-Id` | Correlation id |
| `X-Circuit-State` | Circuit breaker state |
| `Retry-After` | Gateway 429/503 only |
| `Cache-Control` | CDN caching (`public, s-maxage=…`) |

## Request contract

### POST

```http
POST /graphql
Content-Type: application/json

{
  "query": "...",
  "variables": { ... },
  "cache": "default"
}
```

- `query` and `variables` are forwarded to Shopify **unmodified**
- `cache` is gateway-only (`default`, `bypass`, `refresh`) — never sent to Shopify
- Server adds `X-Shopify-Storefront-Access-Token` from env — **never exposed to clients**

### GET (CDN-friendly)

```http
GET /graphql?sha256=<sha256hex(query)>&variables=<url-encoded-json>
GET /graphql?query=<url-encoded-query>&variables=<url-encoded-json>
```

Persisted queries: register a full query once (POST or GET with `query=`), then reference by `sha256`. Unregistered hash → `{ "errors": [{ "message": "PersistedQueryNotFound" }] }`, HTTP 200, `Cache-Control: no-store`.

## Cache behavior

Cache key:

```text
shopify:graphql:storefront:{domain}:{sha256(query + normalizedVariables)}
```

- Different `variables` (collection id, `first`, `after`, `filters`, etc.) → different keys
- **Cached:** HTTP 200 responses with `data` and no `errors`
- **Not cached:** GraphQL `errors[]`, non-200 HTTP from Shopify, gateway rate limits

Cache HIT responses are **byte-identical** to the original Shopify response body.

## HTTP status codes

| Source | Behavior |
|--------|----------|
| Shopify GraphQL field errors | HTTP 200 + `{ errors: [...] }` (Shopify convention) |
| Shopify HTTP 4xx/5xx | Same status + Shopify body preserved |
| Gateway rate limit / circuit open | HTTP 429/503 + `{ errors: [{ message }] }` |
| Validation (bad JSON, limits) | HTTP 400/413/414 + GraphQL error shape |

## Security

- Storefront access token is **server-side only** (`SHOPIFY_STOREFRONT_ACCESS_TOKEN`)
- Client cookies are **not** forwarded to Shopify
- Tokens are **not** logged

## Existing consumers (do not break)

| Consumer | Path | Notes |
|----------|------|-------|
| `public/storefront-gateway.js` | GET `?sha256=…` | Expects raw GraphQL JSON |
| `app/lib/storefront-gateway.ts` | GET helper | Same contract |
| `demo/storefront-direct-vs-proxy.html` | POST + GET lanes | Compares timing, same JSON |
| `scripts/register-persisted-queries.ts` | POST registration | Registers APQ hashes |
| `app/lib/persisted-queries.ts` | Hash definitions | Precomputed SHA-256 |
| `scripts/load-test-coalescing.ts` | Load test | Uses collection query |

REST `/api/v1/*` is a **separate** API — not a substitute for this gateway.

## Tests

Contract tests in:

- `app/lib/__tests__/graphql-contract.test.ts` — passthrough, cache HIT/MISS equality, variables, cache keys
- `app/lib/__tests__/graphql-route-contract.test.ts` — route-level POST/GET/error shapes

Run:

```bash
pnpm test
```

## Architecture (Cloudflare optional)

```text
Client → [optional CDN] → /graphql → L1 → Redis → Shopify Storefront API
```

CDN and Redis may both cache the same response; the JSON body is identical on CDN HIT, Redis HIT, or Shopify MISS.
