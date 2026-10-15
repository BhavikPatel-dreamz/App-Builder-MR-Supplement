#!/usr/bin/env bash
# Run on the India VPS every 30 minutes. Fills local catalog-cache (8088)
# from production origin so the first shopper is a HIT.
set -euo pipefail

export CACHE_ORIGIN_HOST="${CACHE_ORIGIN_HOST:-https://appbuilder.dreamzapps.com}"
export CACHE_WARM_HOST="${CACHE_WARM_HOST:-http://127.0.0.1:8088}"
export CACHE_CRON_SECRET="${CACHE_CRON_SECRET:?set CACHE_CRON_SECRET same as Vercel}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="${WARM_LOG:-/var/log/catalog-warm.log}"

exec >>"$LOG" 2>&1
echo "=== $(date -Is) warm origin=${CACHE_ORIGIN_HOST} local=${CACHE_WARM_HOST} ==="
bash "$ROOT/scripts/warm-edge.sh"
