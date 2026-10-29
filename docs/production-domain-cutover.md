# Production domain cutover

Checklist when the app is already running on a server (Docker + Caddy) and you move the public URL to a new production domain.

Example:

| Role | Host |
|---|---|
| Temporary / previous | `https://mrsupplement.dreamzapps.com` |
| Production | `https://ab.mrsupplement.com.au` |

Do the steps in order. DNS must resolve before Caddy can issue a certificate.

## 1. DNS

In the DNS zone for the production domain (e.g. `mrsupplement.com.au`):

| Type | Name | Value |
|---|---|---|
| `A` | `ab` | AWS / server public IP |

Or `CNAME` to an existing hostname that already points at that server.

Check from your machine:

```bash
dig +short ab.mrsupplement.com.au
```

It must return the server IP before you recreate Caddy.

## 2. Server `.env`

On the production host, update (no trailing slash):

```bash
SHOPIFY_APP_URL=https://ab.mrsupplement.com.au
APP_DOMAIN=ab.mrsupplement.com.au
```

| Variable | Purpose |
|---|---|
| `SHOPIFY_APP_URL` | App origin, OTA file URLs, absolute links |
| `APP_DOMAIN` | Hostname Caddy serves + TLS certificate |

Do not rotate Shopify API keys for a domain-only move. Keep `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `DATABASE_URL`, `REDIS_URL`, Storefront token, and OTA secrets unless you are also rotating credentials.

## 3. Shopify app URLs (`shopify.app.toml`)

```toml
application_url = "https://ab.mrsupplement.com.au"

[auth]
redirect_urls = [ "https://ab.mrsupplement.com.au/api/auth" ]
```

Push to Partners:

```bash
pnpm deploy
```

Or set the same values in Partner Dashboard → App → URLs:

- App URL
- Allowed redirection URL(s): `https://ab.mrsupplement.com.au/api/auth`

After this, embedded Admin login and OAuth use the new host.

## 4. Restart Docker / Caddy

From the project directory on the server:

```bash
docker compose up -d --force-recreate caddy app
```

Caddy reads `APP_DOMAIN` and requests a Let’s Encrypt cert for that hostname. The app reloads `SHOPIFY_APP_URL` from `.env`.

## 5. Verify

```bash
# Landing / health
curl -I https://ab.mrsupplement.com.au/

# Embedded app login path (expect redirect / HTML, not connection error)
curl -sS -o /dev/null -w "%{http_code}\n" https://ab.mrsupplement.com.au/app

# Public CMS
curl -sS -o /dev/null -w "%{http_code}\n" https://ab.mrsupplement.com.au/cms/settings

# GraphQL catalog
curl -sS -o /dev/null -w "%{http_code}\n" "https://ab.mrsupplement.com.au/graphql?catalog=1"

# Hot updater (Android example)
curl -sS "https://ab.mrsupplement.com.au/hot-updater/app-version/android/1.0.1/production/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000" | head
```

TLS must succeed (no certificate name mismatch). If Caddy fails to get a cert, DNS is wrong, port 80/443 is blocked, or another process is bound to those ports.

## 6. Mobile / clients

Anything hardcoded to the old host must switch:

| Need | New URL |
|---|---|
| GraphQL | `https://ab.mrsupplement.com.au/graphql` |
| CMS pages | `https://ab.mrsupplement.com.au/cms/pages` |
| CMS settings | `https://ab.mrsupplement.com.au/cms/settings` |
| Hot updater | `https://ab.mrsupplement.com.au/hot-updater/...` |

Ship an app build (or remote config) that uses the new base URL. Old installs that still call `mrsupplement.dreamzapps.com` keep working only while that hostname still points at the same server.

## 7. Optional: keep or drop the old domain

| Choice | Action |
|---|---|
| Temporary dual host | Point both DNS names at the same IP; add both hostnames to Caddy if needed |
| Hard cutover | After Partners + mobile use the new host, remove the old DNS record |

Shopify Partners should list only the production App URL once cutover is done.

## Cut over live to `ab.mrsupplement.com.au`

Prerequisite: DNS for `ab` is **DNS only** (grey cloud) → AWS IP (`3.87.24.231`). Proxied Cloudflare breaks the Admin iframe.

1. **`shopify.app.toml`**
   ```toml
   application_url = "https://ab.mrsupplement.com.au"
   redirect_urls = [ "https://ab.mrsupplement.com.au/api/auth" ]
   ```
   Then: `pnpm deploy`

2. **Server `.env`**
   ```bash
   SHOPIFY_APP_URL=https://ab.mrsupplement.com.au
   APP_DOMAINS=ab.mrsupplement.com.au
   APP_DOMAIN=ab.mrsupplement.com.au
   ```
   Optional alias while dreamzapps is still needed:
   ```bash
   APP_DOMAINS=ab.mrsupplement.com.au,mrsupplement.dreamzapps.com
   ```

3. **Recreate Caddy + app** (issues / loads TLS for `ab`)
   ```bash
   docker compose up -d --force-recreate caddy app
   ```

4. **Verify**
   ```bash
   dig +short ab.mrsupplement.com.au   # expect ONLY 3.87.24.231
   curl -I https://ab.mrsupplement.com.au/
   # expect 200/302 via Caddy — not TLS alert, not Cloudflare challenge
   ```

5. Open the app from Shopify Admin again (hard refresh). Update mobile base URLs to `https://ab.mrsupplement.com.au`.

## Temporary revert to `mrsupplement.dreamzapps.com`

Use this when `ab.mrsupplement.com.au` is blocked (Cloudflare proxy / challenge) and Admin must work again on the old host.

1. **`shopify.app.toml`**
   ```toml
   application_url = "https://mrsupplement.dreamzapps.com"
   redirect_urls = [ "https://mrsupplement.dreamzapps.com/api/auth" ]
   ```
   Then: `pnpm deploy`

2. **Server `.env`**
   ```bash
   SHOPIFY_APP_URL=https://mrsupplement.dreamzapps.com
   APP_DOMAINS=mrsupplement.dreamzapps.com
   APP_DOMAIN=mrsupplement.dreamzapps.com
   ```

3. **Recreate Caddy + app**
   ```bash
   docker compose up -d --force-recreate caddy app
   ```

4. **Verify**
   ```bash
   dig +short mrsupplement.dreamzapps.com   # expect AWS IP
   curl -I https://mrsupplement.dreamzapps.com/
   ```

## Quick checklist

- [ ] DNS `A`/`CNAME` for the new hostname → server IP
- [ ] `dig` returns the correct IP
- [ ] `.env`: `SHOPIFY_APP_URL` and `APP_DOMAIN` updated
- [ ] `shopify.app.toml` `application_url` + `redirect_urls` updated
- [ ] `pnpm deploy` (or Partner Dashboard URLs saved)
- [ ] `docker compose up -d --force-recreate caddy app`
- [ ] `https://<new-domain>/` TLS OK
- [ ] `/cms/settings`, `/graphql?catalog=1`, `/hot-updater/...` OK
- [ ] Mobile / RN base URL updated
- [ ] Old domain retired or left as temporary alias

## Deploys without multi-minute downtime

`docker compose build` does **not** need to stop the live container. Downtime only happens if you recreate `app` before the new image is ready.

From the repo root on the server:

```bash
# Preferred — build while live, then blue/green swap via Caddy (ports 3000 ↔ 3001)
./deploy/deploy.sh

# Fallback — build while live, then one short recreate (~15–45s)
./deploy/deploy.sh --simple
```

Do **not** use `docker compose up --force-recreate app` until the build has finished, or the site is down for the whole build.

## Related files

| File | Role |
|---|---|
| `.env` / `.env.example` | `SHOPIFY_APP_URL`, `APP_DOMAIN`, `APP_UPSTREAM` |
| `shopify.app.toml` | Partners application + auth URLs |
| `deploy/Caddyfile` | Uses `APP_DOMAINS` + `APP_UPSTREAM` |
| `deploy/deploy.sh` | Zero-downtime-ish production deploy |
| `docker-compose.yml` | App / app_next / Caddy |
| `docs/mobile-graphql-api.md` | Mobile GraphQL base URL |
| `docs/cloudflare-mobile-cache-ab.md` | Cloudflare cache rules for `ab.mrsupplement.com.au` only |
