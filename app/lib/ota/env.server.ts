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
