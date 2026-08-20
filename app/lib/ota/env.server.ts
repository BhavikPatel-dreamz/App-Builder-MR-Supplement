import path from "node:path";

import dotenv from "dotenv";

// Loads the repo-root .env for local tooling (migrate scripts, plain node
// runs). Harmless no-op when the host (Vercel, Docker) supplies the
// variables via the environment instead — dotenv never overrides existing
// vars, so whatever the Shopify CLI / Docker Compose / Vercel already set
// wins.
dotenv.config();

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  publicBaseUrl: trimTrailingSlash(
    process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  ),
  managementToken: process.env.MANAGEMENT_TOKEN ?? "",
  // Postgres connection string. Use the *pooled* endpoint on Neon (host
  // contains "-pooler") — every serverless instance opens its own pool, so
  // connection multiplexing has to happen server-side.
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Directory where OTA bundle bytes live on disk (self-hosted storage).
  // Persisted with a Docker volume in production so bundles survive
  // redeploys. Bundle download URLs are served by this server from here.
  storageDir: path.resolve(
    process.env.OTA_STORAGE_DIR ?? path.join(process.cwd(), "data/ota"),
  ),
  // The *.myshopify.com domain this deployment's OTA belongs to. The Hot
  // Updater tables live in a Postgres database shared by several Shopify apps,
  // so bundle rows must be tagged and filtered by shop. The embedded dashboard
  // scopes to the authenticated session's shop; CLI uploads and device
  // update-checks (which have no session) use this value instead.
  otaShop: (process.env.OTA_SHOP ?? "").trim(),
};

if (!env.managementToken) {
  console.warn(
    "[ota] MANAGEMENT_TOKEN is not set — bundle management routes will reject every request.",
  );
}

if (!env.databaseUrl) {
  console.warn(
    "[ota] DATABASE_URL is not set — every database query will fail. Set it to your Neon pooled connection string.",
  );
}

if (!env.otaShop) {
  console.warn(
    "[ota] OTA_SHOP is not set — CLI bundle uploads and device update-checks will be rejected until it is set to this app's *.myshopify.com domain. (The embedded dashboard is unaffected; it uses the authenticated shop.)",
  );
}
