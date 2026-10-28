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

3. **Recreate Caddy + app** (so the TLS cert matches the dreamzapps host again)
   ```bash
   docker compose up -d --force-recreate caddy app
   ```

4. **Verify**
   ```bash
   dig +short mrsupplement.dreamzapps.com   # expect AWS IP, e.g. 3.87.24.231
   curl -I https://mrsupplement.dreamzapps.com/
   # expect 200/302 via Caddy — not TLS alert, not Cloudflare challenge
   ```

5. Open the app from Shopify Admin again (hard refresh).

Optional: keep both certs while Cloudflare is fixed:
```bash
APP_DOMAINS=mrsupplement.dreamzapps.com,ab.mrsupplement.com.au
```
Only add `ab.mrsupplement.com.au` after that DNS record is **DNS only** (grey cloud) → `3.87.24.231`. Orange-cloud Cloudflare will still break the Admin iframe for `ab`.

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

## Related files

| File | Role |
|---|---|
| `.env` / `.env.example` | `SHOPIFY_APP_URL`, `APP_DOMAIN` |
| `shopify.app.toml` | Partners application + auth URLs |
| `deploy/Caddyfile` | Uses `{$APP_DOMAIN:...}` |
| `docker-compose.yml` | Passes `APP_DOMAIN` into Caddy |
| `docs/mobile-graphql-api.md` | Mobile GraphQL base URL |
