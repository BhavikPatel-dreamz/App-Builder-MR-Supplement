# OTA updates (Hot Updater + Vercel Blob)

How this Shopify app serves React Native over-the-air bundles, and what every
mobile repo must change before `hot-updater deploy` will work on Vercel.

Hot Updater version used here: **0.35.8**.

---

## Why the default CLI fails on Vercel

`@hot-updater/standalone`'s `standaloneStorage` POSTs `bundle.zip` (often
10 MB+) to:

```
POST {PUBLIC_BASE_URL}/hot-updater/upload
```

Vercel Functions reject request **and** response bodies over **4.5 MB**. That
cap cannot be raised. The CLI then prints:

```
[upload] Failed to upload bundle: Request Entity Too Large
```

Vercel Observability shows `413 FUNCTION_PAYLOAD_TOO_LARGE`.

**Fix:** the mobile app must not send the zip through the function. It asks
this server for a short-lived Blob PUT URL (`intent=presign`), then uploads
bytes **directly to Vercel Blob**.

Local/dev without Blob still works: the same plugin falls back to 2.5 MB
chunked POSTs that this server assembles.

---

## Architecture

```
Mobile device                         RN CLI (hot-updater deploy)
     |                                         |
     | GET /hot-updater/app-version/...        | 1) JSON POST /hot-updater/upload
     |     (update-check, no auth)             |    { intent: "presign", key, filename }
     |                                         | 2) PUT file -> Blob (presigned URL)
     v                                         | 3) POST /hot-updater/api/bundles
Shopify app on Vercel  ------------------------+    (bundle row in Postgres)
     |
     |-- Postgres (Neon): bundle metadata, scoped by OTA_SHOP
     |-- Vercel Blob (private): bundle.zip, manifest.json, assets
     |
     GET /hot-updater/files/{key}
         streams the private blob through this app (no public Blob URL)
```

| Piece | Path |
| --- | --- |
| HTTP entry | `app/routes/hot-updater.$.tsx` → `handleOtaRequest` |
| Storage routes | `app/lib/ota/storageRoutes.server.ts` |
| Blob SDK | `app/lib/ota/blob.server.ts` |
| Download URLs | `{PUBLIC_BASE_URL}/hot-updater/files/{key}` |
| CLI plugin (copy into each RN app) | `scripts/ota-chunked-storage.mjs` |
| Dashboard | Shopify admin → OTA Bundles (`app/routes/app.ota.tsx`) |

Protocol for stored keys is `storage://` (example:
`storage://01a05b92-…/bundle.zip`). Devices never see that; they get the
`/hot-updater/files/…` URL.

---

## Server-side code changes (copy into the other Vercel / Shopify app)

These are the changes already made **in this Shopify repo**. If the other
project is a second Vercel app (not only a second RN repo), port these
files and behaviors. Same Vercel project + same git deploy does **not**
need this again.

### New / changed files

| File | What we added |
| --- | --- |
| `app/lib/ota/blob.server.ts` | **New.** Vercel Blob wrapper: private `put` / `get` / `del` / `list`, `issueSignedToken` + `presignUrl` for CLI PUTs, OIDC from `x-vercel-oidc-token` then `getVercelOidcToken()`, `AsyncLocalStorage` so upload/download see the current Request |
| `app/lib/ota/storage.server.ts` | `saveFile` / `readFileBytesOrNull` / `deleteFile` go through Blob when `usesBlobStorage()` is true; otherwise local `OTA_STORAGE_DIR`. `key` is `{prefix}/{filename}`. Content-addressed keys under `*/assets/sha256/` normalize back to `assets/sha256/…`. MIME map includes png/gif/webp/svg/fonts/css/html |
| `app/lib/ota/storageRoutes.server.ts` | `/upload` supports `intent=presign` (JSON), `intent=chunk`, `intent=assemble`, and small multipart files. Rejects bodies over ~3.5 MB with a 413 that tells the CLI to use the chunked plugin. Presign MIME is taken from the **filename**, not the CLI’s `application/octet-stream` |
| `app/lib/ota/handler.server.ts` | `GET /hot-updater/files/*` streams `blobGet` (no Bearer). Logs `{ blob, hasStoreId, hasOidc }`. Blob errors → **502**. Miss → list prefix keys then **404**. Wraps every OTA request in `runWithOtaRequest(request)` so Blob sees the OIDC header |
| `app/lib/ota/env.server.ts` | `withVerifyFullSsl` rewrites Postgres `sslmode=require\|prefer\|verify-ca` → `verify-full`. Warns on Vercel if Blob env is missing. Read Blob flags with `process.env["NAME"]` so Vite cannot inline empties |
| `app/routes/hot-updater.$.tsx` | Unchanged contract: `loader`/`action` → `handleOtaRequest`. Keep this splat route |
| `scripts/ota-chunked-storage.mjs` | **New.** Drop-in for each RN app (see mobile section) |
| `scripts/ota-import.mjs` | Same `sslmode` helper as `env.server.ts` if you import bundles |
| `package.json` | `"@vercel/blob": "^2.3.1"`, `"@vercel/oidc": "^3.6.1"` |
| `vite.config.ts` | `ssr.external` + `environments.ssr.resolve.external`: `@vercel/blob`, `@vercel/oidc` so the SDK is not bundled with empty `BLOB_*` / OIDC |
| `pnpm-lock.yaml` | Refresh after `pnpm install` (do not use a frozen lockfile if those packages are new) |

### `blob.server.ts` rules (do not skip)

1. **Never** write `process.env.BLOB_STORE_ID` as a static identifier. Vite
   inlines it as `""` at build time, dead-code-eliminates the Blob branch,
   and file GET 404s with **no** outbound Blob call. Use
   `node:process` + `process.env[name]` (dynamic key).
2. `usesBlobStorage()` is true if any of:
   `BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN`,
   `BLOB_READ_WRITE_TOKEN_STORE_ID`, or `VERCEL`.
   On Vercel, always use Blob — never ephemeral function disk for OTA
   bytes.
3. Pass `storeId` / `oidcToken` / `token` into every SDK call
   (`put`, `get`, `del`, `list`, `issueSignedToken`).
4. Resolve OIDC in this order: request header `x-vercel-oidc-token` →
   `VERCEL_OIDC_TOKEN` → `getVercelOidcToken()` from `@vercel/oidc`.
   Fluid often has **no** `process.env.VERCEL_OIDC_TOKEN`
   (`hasOidc: false` in logs is normal if the header is present).
5. All Blob objects use `access: "private"`. `get(..., { useCache: false })`
   for downloads.
6. **Presign must not set `allowedContentTypes`.** Blob checks the
   pathname-inferred type (`.png` → `image/png`). A zip/json/octet-stream
   allow-list caused `403 "contentType" image/png is not allowed` after
   `bundle.zip` already succeeded. Cap size only (`512 MB`).
7. `addRandomSuffix: false`, `allowOverwrite: true` so keys stay
   `{bundleId}/bundle.zip`.

### `/upload` behaviors to port

```ts
// JSON  Content-Type: application/json
{ intent: "presign", key, filename }
→ { uploadUrl, method: "PUT", contentType, storageUri, pathname }

// multipart intent=chunk
uploadId, chunkIndex, totalChunks, filename, file
→ { ok, received, totalChunks }

// multipart intent=assemble
uploadId, totalChunks, key, filename
→ { storageUri }   // concatenates .chunks/{uploadId}/{i} then deletes them

// multipart default (small files only)
key + file → { storageUri }
```

Object key is always `resolveObjectKey(key, filename)` →
`${keyPrefix}/${filename}`. Treating `key` alone as the path overwrites
`bundle.zip` with `manifest.json`.

### `/files/*` behaviors to port

- No management token (devices download this URL from update-check).
- `assertSafeKey` after `decodeURIComponent`.
- Blob path: `blobGet(key)` → stream 200, or list prefix + 404, or 502
  if the SDK throws.
- Disk path (local only): `readFileBytesOrNull`.

### Vite (required for Blob on this stack)

`react-router.config.ts` already enables `v8_viteEnvironmentApi`. Set
**both** so the Environment API does not re-bundle the SDK:

```ts
// vite.config.ts (returned config object)
ssr: {
  external: ["@vercel/blob", "@vercel/oidc"],
},
environments: {
  ssr: {
    resolve: {
      external: ["@vercel/blob", "@vercel/oidc"],
    },
  },
},
```

### Related non-OTA build fixes already on this app

Port these only if the other Shopify app is the same Vite + React Router
template and you want the same production build:

- `vite.config.ts`: `chunkSizeWarningLimit: 20000`; client `manualChunks`
  only for `react-icons` and `@shopify/*` — **do not** group
  `gutenberg-block-kit` (it collapses the kit’s lazy split into a ~19 MB
  chunk).
- `react-router.config.ts` future flags: `v8_middleware`,
  `v8_splitRouteModules`, `v8_viteEnvironmentApi`,
  `v8_passThroughRequests`, `v8_trailingSlashAwareDataRequests`.
- `app/styles/wp-block-library.css`: remove `@charset`; charset-removal
  PostCSS plugin in `vite.config.ts`.
- Static Prisma import in `app/routes/pages.$slug.tsx` (avoid mixed
  dynamic/static client).

These do not affect OTA uploads. Skip them if the other server repo has
no CMS / Gutenberg.

### Port checklist (second Shopify + Vercel app)

- [ ] `pnpm add @vercel/blob @vercel/oidc`
- [ ] Copy `app/lib/ota/blob.server.ts` and wire `runWithOtaRequest` in the
      OTA handler
- [ ] Blob branch in `storage.server.ts` + MIME map + `{prefix}/{filename}`
- [ ] Presign / chunk / assemble in `storageRoutes.server.ts` (no MIME
      allow-list on presign)
- [ ] File serve streams `blobGet`; 502 on SDK errors; list-on-miss logs
- [ ] `vite.config.ts` `ssr.external` + `environments.ssr.resolve.external`
- [ ] Env: `BLOB_STORE_ID` (empty prefix), `PUBLIC_BASE_URL`,
      `MANAGEMENT_TOKEN`, `OTA_SHOP`, `DATABASE_URL`
- [ ] Connect Blob in that Vercel project, redeploy
- [ ] Copy `scripts/ota-chunked-storage.mjs` into **each** RN app and
      switch the storage import (mobile section below)

---

## Server (this Vercel project)

Do this **once** per Vercel project. Other mobile repos that point at the
same `PUBLIC_BASE_URL` reuse it.

### 1. Connect Vercel Blob

In the Vercel project: **Storage → Create / Connect Blob**.

- Leave the custom environment-variable **prefix empty**.
- You want `BLOB_STORE_ID` (OIDC). Do **not** set the prefix to
  `BLOB_READ_WRITE_TOKEN`.
- `BLOB_WEBHOOK_PUBLIC_KEY` is unused (presigned-upload webhooks only).
- `BLOB_READ_WRITE_TOKEN` is optional/legacy. OIDC is enough on Vercel.

Store must be usable as **private**. Downloads go through
`/hot-updater/files/*`, not `*.blob.vercel-storage.com`.

### 2. Environment variables (Production)

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** URL (`-pooler` host) |
| `MANAGEMENT_TOKEN` | yes | Bearer token for CLI upload + bundle APIs |
| `PUBLIC_BASE_URL` | yes | Public origin, no trailing slash. Example: `https://appbuilder.dreamzapps.com` |
| `OTA_SHOP` | yes | This app's `*.myshopify.com` domain. CLI + device update-checks use it; the embedded dashboard uses the logged-in shop instead |
| `BLOB_STORE_ID` | yes on Vercel | Created when Blob is connected |
| `VERCEL_OIDC_TOKEN` | injected | Do not set by hand. Fluid often puts the token on `x-vercel-oidc-token`, not `process.env` |
| `OTA_STORAGE_DIR` | no | Local disk fallback only (`data/ota`). Ephemeral on Vercel |

Redeploy after connecting Blob so the function sees `BLOB_STORE_ID`.

### 3. Confirm the server build

Production logs on a file GET should look like:

```
[ota] files { key: '…/bundle.zip', blob: true, hasStoreId: true, hasOidc: true, hasVercel: true }
```

`hasOidc: false` with `hasStoreId: true` can still work (token on the
request header). A **502** is auth/config. A **404** with
`[ota] blob get miss` means the object is not in Blob (old 413 deploys
left a Postgres row and no zip).

---

## Each mobile repo (repeat on every RN app)

The server change is not enough. **Every** repo that runs
`hot-updater deploy` must use the chunked/presign storage plugin.

### 1. Copy the plugin

From this repo:

```
scripts/ota-chunked-storage.mjs
```

into the RN app **root** (same folder as `hot-updater.config.ts` /
`hot-updater.config.js`):

```
mr_supplement_mobile/ota-chunked-storage.mjs
```

### 2. Switch the storage import

In `hot-updater.config.ts` (or `.js` / `.mts`) at the RN project root:

```ts
- import { standaloneStorage } from "@hot-updater/standalone";
+ import { standaloneStorage } from "./ota-chunked-storage.mjs";
```

Leave the call the same:

```ts
import { standaloneRepository } from "@hot-updater/standalone";
import { standaloneStorage } from "./ota-chunked-storage.mjs";
import { defineConfig } from "hot-updater";

export default defineConfig({
  // build: …
  storage: standaloneStorage({
    baseUrl: process.env.HOT_UPDATER_SERVER_URL, // must end with /hot-updater
    // Must match the scheme this server writes. See PROTOCOL in
    // app/lib/ota/storage.server.ts. Do not use "s3".
    protocol: "storage",
    commonHeaders: {
      Authorization: `Bearer ${process.env.MANAGEMENT_TOKEN}`,
    },
  }),
  database: standaloneRepository({
    baseUrl: process.env.HOT_UPDATER_SERVER_URL,
    commonHeaders: {
      Authorization: `Bearer ${process.env.MANAGEMENT_TOKEN}`,
    },
  }),
  updateStrategy: "appVersion",
});
```

Find the config file:

```bash
cd /path/to/your_rn_app
ls hot-updater.config.*
# or
find . -name "hot-updater.config.*" -not -path "./node_modules/*"
```

It is **not** in the Shopify repo.

### 3. Mobile env (`.env.hotupdater` or shell)

| Name | Example |
| --- | --- |
| `HOT_UPDATER_SERVER_URL` | `https://appbuilder.dreamzapps.com/hot-updater` |
| `MANAGEMENT_TOKEN` | same value as Vercel `MANAGEMENT_TOKEN` |

`HOT_UPDATER_SERVER_URL` must include the `/hot-updater` suffix and must
**not** have a trailing slash after it if your plugin already strips
slashes (the plugin trims trailing slashes).

### 4. Deploy a bundle

```bash
# from the RN app
npx hot-updater deploy
```

**Proof the new plugin is active** (you will see these in the CLI):

```
[ota] using chunkedStandaloneStorage — large files go to Blob via presign, not a single POST /upload
[ota] PUT bundle.zip (10417308 bytes) directly to Blob
[ota] PUT <hash>.png (…) directly to Blob
```

The spinner name is `chunkedStandaloneStorage`, not `standaloneStorage`.

If you still see `[upload] Failed to upload bundle: Request Entity Too Large`,
the config is still importing from `@hot-updater/standalone`.

### 5. After the first successful upload

1. Open the Shopify app → **OTA Bundles**.
2. Confirm the new bundle id and that it is enabled on the right channel.
3. **Disable** any older bundle that was created during the 413 failures
   (example: `01a05b92-3d7f-7cc1-8a7b-8503470af4f8`). Those rows point at
   zips that never landed in Blob; devices will 404 in a loop.
4. On a device/build with matching `targetAppVersion` (e.g. `1.0.3`),
   update-check should return the new id, then
   `GET /hot-updater/files/{id}/bundle.zip` should be **200**.

---

## Applying this to another mobile repo on the same Vercel server

Same Shopify app / same `PUBLIC_BASE_URL`:

1. Copy `ota-chunked-storage.mjs` into that RN repo.
2. Change the `standaloneStorage` import as above.
3. Point `HOT_UPDATER_SERVER_URL` and `MANAGEMENT_TOKEN` at this server.
4. Deploy. No extra Vercel work.

Different Shopify shop but **shared** Postgres:

- Set that app’s `OTA_SHOP` to **its** `*.myshopify.com` domain.
- Bundles are isolated by shop. Devices and CLI uploads for shop A never
  see shop B’s rows.
- Open that shop’s embedded app once so a `ShopSettings` row exists
  (otherwise bundle create returns 409).

Different Vercel project:

- Repeat the Blob connect + env table above.
- Copy the OTA server code (`app/lib/ota/*`, `app/routes/hot-updater.$.tsx`,
  `scripts/ota-chunked-storage.mjs`) or deploy this same app.

---

## Upload contract (server)

`POST /hot-updater/upload` (Bearer `MANAGEMENT_TOKEN`):

| `intent` | Body | Result |
| --- | --- | --- |
| `presign` (JSON) | `{ intent, key, filename, contentType? }` | `{ uploadUrl, method: "PUT", contentType, storageUri, pathname }` — CLI PUTs the file to `uploadUrl` |
| `chunk` (multipart) | `uploadId`, `chunkIndex`, `totalChunks`, `filename`, `file` | store one ≤2.5 MB part |
| `assemble` (multipart) | `uploadId`, `totalChunks`, `key`, `filename` | concat parts → `{ storageUri }` |
| default (multipart) | `key` + `file` | small files only; bodies over ~3.5 MB are rejected with 413 |

`key` is a **prefix**. The object path is `{key}/{filename}`:

- `{bundleId}/bundle.zip`
- `{bundleId}/manifest.json`
- `assets/sha256/{shard}/{hash}.png` (content-addressed)

The presign token does **not** restrict MIME types. Hermes assets include
`.png`, `.js`, `.json`, `.zip`, `.br`, fonts, etc. Blob infers type from
the pathname; a zip-only allow-list caused `403 contentType image/png is
not allowed`.

Other storage routes (same Bearer token):

- `DELETE /hot-updater/delete` `{ storageUri }`
- `POST /hot-updater/readText` `{ storageUri }`
- `POST /hot-updater/getDownloadUrl` `{ storageUri }` → `{ fileUrl }`

Update-check routes are public (no Bearer):

```
GET /hot-updater/app-version/{platform}/{appVersion}/{channel}/…
```

---

## Troubleshooting

| Symptom | Cause | What to do |
| --- | --- | --- |
| CLI: `[upload] Failed to upload bundle: Request Entity Too Large` | Official `standaloneStorage` still in use | Change the import to `./ota-chunked-storage.mjs` |
| Vercel: `413 FUNCTION_PAYLOAD_TOO_LARGE` on `/hot-updater/upload` | Same as above | Same |
| CLI: `Blob PUT failed (403) contentType image/png is not allowed` | Old server presign allow-list | Deploy this Shopify app (current `blobPresignPut` has no MIME allow-list), retry |
| Update-check 200, files GET 404, log `blob get miss` | Postgres row exists, zip never stored (old 413 deploys) | Disable that bundle; deploy again with the new plugin |
| Files GET 502 `Blob storage error` | Missing `BLOB_STORE_ID` / OIDC | Connect Blob, redeploy, no custom env prefix |
| Files GET 404, `blob: false` | Build inlined empty Blob env (old bug) | Current server treats Vercel as Blob and reads env at runtime |
| Bundle create 409 / `bundles_shop_fkey` | No `ShopSettings` for `OTA_SHOP` | Open the embedded app once for that shop |
| CLI 401 on `/upload` | Wrong/missing `MANAGEMENT_TOKEN` | Match Vercel env |
| Device never updates | Channel / `targetAppVersion` mismatch, or ghost bundle still enabled | Check dashboard filters; disable broken ids |

Useful production logs:

```
[update-check] platform=ios appVersion=1.0.3 channel=production servedBundleId=…
[ota] blob presign { key: '…/bundle.zip', contentType: 'application/zip' }
[ota] files { key, blob: true, hasStoreId: true, listed: […] }
```

On a miss, `listed` is the Blob keys under that bundle-id prefix. `[]`
means nothing was uploaded for that id.

---

## Checklist for a second RN repo

- [ ] `ota-chunked-storage.mjs` copied next to `hot-updater.config.*`
- [ ] Storage import is `./ota-chunked-storage.mjs`, not `@hot-updater/standalone`
- [ ] `HOT_UPDATER_SERVER_URL` = `https://<this-vercel-host>/hot-updater`
- [ ] `MANAGEMENT_TOKEN` matches Vercel
- [ ] Shopify app already deployed with Blob + current presign code
- [ ] `hot-updater deploy` prints `[ota] PUT bundle.zip … directly to Blob`
- [ ] New bundle appears in OTA dashboard and is enabled
- [ ] Old 413-era bundle ids are disabled
- [ ] Device update-check + `/files/…/bundle.zip` both succeed
