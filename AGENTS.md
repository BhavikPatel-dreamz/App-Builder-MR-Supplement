# AGENTS.md

## Stack

- **Shopify embedded app** using React Router (converted from Remix), Vite, TypeScript, Prisma + PostgreSQL.
- **CMS editor**: Headless Gutenberg via `gutenberg-block-kit` — blocks run client-only inside an iframe.
- **Package manager**: pnpm (workspace: `extensions/*`).
- **Node**: `>=20.19 <22 || >=22.12`.
- **Production deploy**: Vercel (`riyasat-builder.vercel.app`).

## Dev commands

```bash
pnpm dev            # shopify app dev with tunnel (dd-99.dynamicdreamz.com:3000)
pnpm lint           # eslint (cached)
pnpm typecheck      # react-router typegen + tsc --noEmit
pnpm build          # prisma generate && react-router build
pnpm setup          # prisma generate && prisma migrate deploy (DB init)
pnpm deploy         # shopify app deploy
```

Run `pnpm lint && pnpm typecheck` before committing. After adding blocks, also verify SSR is clean (see below).

## Architecture

```
app/
  routes/           # React Router flat-routes (file-based)
  blocks/           # Gutenberg blocks (client-only .jsx) + constants.ts + index.ts barrel
  components/cms/   # CmsEditorShell, CmsEditor.client, actionsConfig
  lib/              # Server-only helpers (cms, media, settings, shopify-collections, shopify-files)
  shopify.server.ts # Shopify app config (auth, sessions via Prisma, API version)
  db.server.ts      # Prisma client singleton (HMR-safe)
prisma/
  schema.prisma     # Session, Page, Media, ShopSettings models
extensions/         # Shopify app extensions (empty currently)
```

- Routes use `flatRoutes()` — filenames map directly to URL paths.
- `app/lib/*.server.ts` files are server-only; never import them in client code.
- `app/routes.ts` is just `flatRoutes()` — do not add manual route entries.

## Block system (critical rules)

**Read `app/blocks/README.md` first** — it contains the full recipe, templates, and verification steps for adding blocks.

Key constraints:
- **Always import `@wordpress/*` from `gutenberg-block-kit/wp/*`** — never directly. The kit provides a singleton; direct imports create a second registry and blocks silently disappear.
- **Block `.jsx` files are client-only** — they pull `@wordpress/emotion` (needs `document`). Never static-import them from SSR code.
- **`constants.ts` is safe for SSR** (plain strings only).
- `app/blocks/index.ts` barrel is loaded client-only via `useEffect` in `CmsEditorShell.tsx`.

### Adding a block (3 steps)

1. `constants.ts` — add block name constant + append to `RIYASAT_BLOCKS`.
2. `app/blocks/<kebab>/index.jsx` — write block(s), export `register<Name>()`.
3. `app/blocks/index.ts` — import + call `register<Name>()` inside the `registerBlocks` callback (before the unregister sweep).

### Block verification

```bash
npx tsc --noEmit -p tsconfig.json        # only pre-existing cms.server.ts error allowed
npx react-router build                   # must exit 0
grep -rl "wp-runtime" build/server/      # must print nothing (SSR clean)
```

## Shopify app proxy

Storefront/mobile requests to `https://{shop}.myshopify.com/apps/cms/...` are signed by Shopify and forwarded to `https://riyasat-builder.vercel.app/proxy/...`. The mobile app fetches published page JSON through these signed URLs. See `shopify.app.toml` `[app_proxy]` section.

## Webhooks

Defined in `shopify.app.toml` (app-specific, not code-registered):
- `app/uninstalled` → `/webhooks/app/uninstalled`
- `app/scopes_update` → `/webhooks/app/scopes_update`

API version: `2026-07`. Do not use `registerWebhooks` in `afterAuth` — prefer TOML-declared webhooks.

## Gotchas

- **`vite.config.ts`** replaces `HOST` env var with `SHOPIFY_APP_URL` to avoid Vite server breakage — this is a known Shopify CLI issue.
- **Embedded app navigation**: Use `Link` from react-router, never `<a>`. Use `redirect` from `authenticate.admin`, never from react-router directly.
- **Prisma client**: `db.server.ts` uses a global singleton with HMR-aware cleanup. The `isStalePrismaClient` check detects when new models are added without restarting.
- **`gutenberg-block-kit/editor`** is excluded from Vite `optimizeDeps.include` — it must not be pre-bundled.
- **`gutenberg-block-kit/editor`** must only be imported in client-only code (`.client.tsx` or `useEffect`).

## MCP

Shopify Dev MCP is configured in `.mcp.json`. Claude Code has it disabled in `.claude/settings.local.json`.

## Key files

| File | Purpose |
|------|---------|
| `app/blocks/README.md` | Block authoring recipe + templates — read before adding any block |
| `ACTIONS.md` | Button action system documentation for blocks |
| `app/blocks/constants.ts` | Block name registry (SSR-safe) |
| `app/blocks/index.ts` | Block registration barrel (client-only) |
| `app/shopify.server.ts` | Shopify app singleton config |
| `app/components/cms/CmsEditorShell.tsx` | Main CMS editor mount (client-only block loading) |
| `app/components/cms/actionsConfig.ts` | Shopify-specific action definitions for block buttons |
| `shopify.app.toml` | App config, webhooks, proxy, access scopes |
