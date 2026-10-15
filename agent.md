# Agent notes — API / GraphQL / Cache

**Current task:** Catalog cache — self-generated, first user HIT, 10–20ms

**Status:** Implemented in repo (ops: nginx DNS, native host, shopify app deploy, CF stale)

## In repo

- TTL clamp 600–1800s (default 1800) Redis = Cache-Control
- Catalog warmer: 500 collections / 10k products / 400 jobs / concurrency 8; never-warmed URLs `refresh` immediately
- Self-learn extra `after` / `productsByIds` into next cron
- Edge fill origin + `CACHE_INDIA_WARM_HOST`
- Webhooks re-warm that product/collection (no shop-wide Redis flush)
- India nginx 30m; `scripts/warm-edge.sh`

## Ops remaining

- Install nginx on dd-106; native catalog hostname + keep-alive
- `shopify app deploy`; set CF token; Cache Rule serve-stale
- Persist native GraphQL bodies once (POST or Cache URL paste) so APQ hashes resolve
