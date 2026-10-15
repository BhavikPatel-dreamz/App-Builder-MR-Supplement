# Phase 2 — India cache (dd-106)

**Goal:** Native catalog GETs from India HIT a local nginx cache (~10–30ms). Cloudflare SIN/HKG stays ~100ms+ even on HIT.

## Architecture

```
Native (India)
  → hostname pointed at dd-106 (nginx proxy_cache, 10 min + stale)
    HIT  → disk, no origin
    MISS → HTTPS to appbuilder.dreamzapps.com (CF → Vercel → Redis/Shopify)
```

Do **not** orange-cloud the India hostname. Point A/AAAA at dd-106 only.

Keep `appbuilder.dreamzapps.com` as Shopify app URL / admin / OAuth.

## Native app

- Base URL for **GET** `/graphql`, `/cms/pages`, `/cms/settings` = India hostname.
- Reuse HTTP/2 (keep-alive). New TLS each call will look like 100ms+ even on nginx HIT.
- Do not send session cookies on catalog GET.

## Install (dd-106)

1. Copy `infra/dd-106/nginx-catalog-cache.conf` into `/etc/nginx/sites-available/catalog-cache`.
2. `mkdir -p /var/cache/nginx/catalog && chown www-data:www-data /var/cache/nginx/catalog`
3. Enable site, `nginx -t && systemctl reload nginx`.
4. Prove HIT:

```bash
URL='http://127.0.0.1:8088/cms/settings'
curl -sS -D - -o /dev/null "$URL" | grep -i x-india-cache
curl -sS -D - -o /dev/null "$URL" | grep -i x-india-cache
# first MISS or BYPASS; second HIT
```

5. Put TLS on 443 later (cert for the India hostname). Point DNS at this box.
6. Cron warm **this** host so the disk cache is full:

```bash
export CACHE_WARM_HOST=http://127.0.0.1:8088
export CACHE_CRON_SECRET=...
# scripts/warm-edge.sh every 5 minutes
```

## Origin / CF

- Origin TTL is 10–30 minutes (`s-maxage` up to 1800).
- Optional: `CF_ZONE_ID` + `CF_API_TOKEN` so product/collection webhooks purge then re-warm those URLs.
- Deploy `shopify.app.toml` webhooks (`products/*`, `collections/update`) with `shopify app deploy`.

## What 20ms requires

India hostname + nginx HIT + reused connection. Measuring `appbuilder.dreamzapps.com` from Mumbai still goes through Cloudflare PoPs (SIN/HKG), not this box.
