#!/usr/bin/env bash
# Warm India nginx (or Cloudflare) from dd-106 every 5 minutes.
#
#   export CACHE_CRON_SECRET='your-secret'
#   export CACHE_WARM_HOST=http://127.0.0.1:8088   # after nginx is installed
#   crontab: */5 * * * * /usr/local/bin/warm-edge.sh >>/tmp/warm-edge.log 2>&1

set -euo pipefail

ORIGIN_HOST="${CACHE_ORIGIN_HOST:-https://appbuilder.dreamzapps.com}"
HOST="${CACHE_WARM_HOST:-$ORIGIN_HOST}"
CURL_OPTS=()
if [[ "${CACHE_WARM_INSECURE:-}" == "1" ]]; then
  CURL_OPTS+=(-k)
fi

SHA="759dff3d67482d144ca62a01301eb3e214641c3ed0cf99b0e871495ce4db6611"
APP_VARS='%7B%22id%22%3A%22gid%3A%2F%2Fshopify%2FCollection%2F375678697663%22%2C%22first%22%3A10%2C%22after%22%3Anull%7D'

rewrite_host() {
  local url="$1"
  if [[ "$HOST" != "$ORIGIN_HOST" ]]; then
    url="${url//$ORIGIN_HOST/$HOST}"
  fi
  printf '%s' "$url"
}

URLS=(
  "$(rewrite_host "${ORIGIN_HOST}/cms/settings")"
  "$(rewrite_host "${ORIGIN_HOST}/cms/pages")"
  "$(rewrite_host "${ORIGIN_HOST}/graphql?sha256=${SHA}&variables=${APP_VARS}")"
)

if [[ -n "${CACHE_CRON_SECRET:-}" ]]; then
  mapfile -t CATALOG < <(
    curl -sS "${CURL_OPTS[@]}" -H "x-cron-secret: ${CACHE_CRON_SECRET}" \
      "${ORIGIN_HOST}/api/cron/cache-urls" \
      | python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(d.get("urls") or []))'
  ) || true
  for raw in "${CATALOG[@]+"${CATALOG[@]}"}"; do
    [[ -z "${raw}" ]] && continue
    URLS+=("$(rewrite_host "$raw")")
  done
fi

echo "=== $(date -Is) warm host=${HOST} urls=${#URLS[@]} ==="

for url in "${URLS[@]}"; do
  [[ -z "${url}" ]] && continue
  curl -sS "${CURL_OPTS[@]}" -o /dev/null -D - -w "req1 TTFB=%{time_starttransfer}\n" \
    -H "accept: application/json" \
    -H "X-Cache-Warm: 1" \
    "$url" \
    --next \
    -o /dev/null -D - -w "req2 TTFB=%{time_starttransfer} ${url}\n" \
    -H "accept: application/json" \
    -H "X-Cache-Warm: 1" \
    "$url" \
    | grep -iE 'cf-cache-status|x-india-cache|TTFB' || true
done
