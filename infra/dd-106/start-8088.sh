#!/usr/bin/env bash
# India catalog cache on 8088. Prefers Node (no aaPanel). Optional OpenResty if lua path works.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${CATALOG_CACHE_PORT:-8088}"
LOG="/tmp/catalog-cache-8088.log"
PIDF="/tmp/catalog-cache-8088.pid"

if ss -ltn | grep -q ":${PORT} "; then
  echo "already listening on ${PORT}"
  curl -sS "http://127.0.0.1:${PORT}/healthz" || true
  exit 0
fi

if [[ "${USE_NGINX_8088:-}" == "1" ]]; then
  mkdir -p "$ROOT/var-cache" || mkdir -p /tmp/nginx-catalog-cache
  NGINX="${NGINX_BIN:-/www/server/nginx/sbin/nginx}"
  "$NGINX" -t -c "$ROOT/nginx-catalog-8088-standalone.conf"
  "$NGINX" -c "$ROOT/nginx-catalog-8088-standalone.conf"
else
  nohup node "$ROOT/catalog-cache.mjs" >>"$LOG" 2>&1 &
  echo $! >"$PIDF"
  sleep 0.4
fi

ss -ltn | grep "${PORT}" || true
curl -sS "http://127.0.0.1:${PORT}/healthz"
echo
