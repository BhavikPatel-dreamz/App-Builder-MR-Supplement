#!/usr/bin/env bash
# Zero-downtime-ish production deploy for host-network Docker.
#
# 1. Build the new image while the current app keeps serving traffic.
# 2. Start app_next on the idle port (3000 <-> 3001).
# 3. Wait until it answers HTTP.
# 4. Point Caddy at the new port (brief reload only — no app gap).
# 5. Stop the old app container and promote the new one to "appbuilder".
#
# Usage (from repo root on the server):
#   ./deploy/deploy.sh
#
# Fallback (short downtime, ~15–45s after build):
#   ./deploy/deploy.sh --simple

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE_FILE="$ROOT/deploy/active-port"
SIMPLE=0
if [[ "${1:-}" == "--simple" ]]; then
  SIMPLE=1
fi

log() { printf '[deploy] %s\n' "$*"; }

wait_http() {
  local port="$1"
  local tries="${2:-60}"
  local i=0
  log "Waiting for http://127.0.0.1:${port}/ …"
  while (( i < tries )); do
    if curl -fsS -o /dev/null --connect-timeout 2 "http://127.0.0.1:${port}/"; then
      log "Port ${port} is up"
      return 0
    fi
    # 302/301 also mean the Node process is listening
    code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 "http://127.0.0.1:${port}/" || true)"
    if [[ "$code" =~ ^(200|301|302|303|307|308)$ ]]; then
      log "Port ${port} is up (HTTP ${code})"
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  log "Timed out waiting for port ${port}"
  return 1
}

flip_caddy() {
  local upstream="$1"
  export APP_UPSTREAM="$upstream"
  # Persist for the next compose up
  if grep -q '^APP_UPSTREAM=' .env 2>/dev/null; then
    sed -i.bak "s|^APP_UPSTREAM=.*|APP_UPSTREAM=${upstream}|" .env
  else
    printf '\nAPP_UPSTREAM=%s\n' "$upstream" >> .env
  fi
  if grep -q '^APP_PORT=' .env 2>/dev/null; then
    sed -i.bak "s|^APP_PORT=.*|APP_PORT=${upstream##*:}|" .env
  else
    printf 'APP_PORT=%s\n' "${upstream##*:}" >> .env
  fi
  docker compose up -d --no-deps --force-recreate caddy
  log "Caddy now proxies ${upstream}"
}

# --- build (site stays up) ---
log "Building image (live site stays up)…"
docker compose build app
log "Build finished"

if [[ "$SIMPLE" -eq 1 ]]; then
  log "Simple recreate — short downtime while app restarts"
  docker compose up -d --no-deps --force-recreate app
  wait_http "${APP_PORT:-3000}" 90
  log "Done"
  exit 0
fi

# --- blue/green ports ---
OLD_PORT="$(cat "$STATE_FILE" 2>/dev/null || echo 3000)"
if [[ "$OLD_PORT" == "3000" ]]; then
  NEW_PORT=3001
else
  NEW_PORT=3000
fi
log "Active port=${OLD_PORT} → next port=${NEW_PORT}"

# Remove a leftover next container from a failed deploy
docker rm -f appbuilder-next >/dev/null 2>&1 || true

export APP_NEXT_PORT="$NEW_PORT"
log "Starting app_next on ${NEW_PORT}…"
docker compose --profile next up -d --no-deps app_next

if ! wait_http "$NEW_PORT" 90; then
  log "New container failed health check — leaving Caddy on ${OLD_PORT}"
  docker logs --tail 80 appbuilder-next || true
  docker rm -f appbuilder-next >/dev/null 2>&1 || true
  exit 1
fi

flip_caddy "127.0.0.1:${NEW_PORT}"

log "Stopping old app on ${OLD_PORT}…"
docker stop appbuilder >/dev/null 2>&1 || true
docker rm appbuilder >/dev/null 2>&1 || true

log "Promoting appbuilder-next → appbuilder"
docker rename appbuilder-next appbuilder
# Match compose labels so future `compose up` manages this container
docker update --restart unless-stopped appbuilder >/dev/null

echo "$NEW_PORT" > "$STATE_FILE"
log "Deploy complete. Live upstream 127.0.0.1:${NEW_PORT}"
log "Verify: curl -I https://ab.mrsupplement.com.au/"
