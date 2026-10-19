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

/**
 * pg v8 treats sslmode=require/prefer/verify-ca as verify-full and warns that
 * pg v9 will give them weaker libpq meaning. Neon already presents a valid
 * cert, so pin verify-full and keep today's security without the warning.
 */
export function withVerifyFullSsl(connectionString: string): string {
  if (!connectionString) return connectionString;
  try {
    const url = new URL(connectionString);
    const mode = url.searchParams.get("sslmode");
    if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

function readEnv(name: string): string {
  try {
    const value = process.env[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  // Dynamic key so a build-time localhost value is not frozen into the bundle.
  get publicBaseUrl() {
    return trimTrailingSlash(readEnv("PUBLIC_BASE_URL") || "http://localhost:3000");
  },
  managementToken: process.env.MANAGEMENT_TOKEN ?? "",
  // Postgres connection string. Use the *pooled* endpoint on Neon (host
  // contains "-pooler") — every serverless instance opens its own pool, so
  // connection multiplexing has to happen server-side.
  databaseUrl: withVerifyFullSsl(process.env.DATABASE_URL ?? ""),
  // Directory where OTA bundle bytes live on disk (self-hosted storage).
  // On Vercel this filesystem is ephemeral — listing bundle rows from
  // Postgres still works; downloading bytes later needs object storage.
  storageDir: path.resolve(
    process.env.OTA_STORAGE_DIR ?? path.join(process.cwd(), "data/ota"),
  ),
  // The *.myshopify.com domain this deployment's OTA belongs to. The Hot
  // Updater tables live in a Postgres database shared by several Shopify apps,
  // so bundle rows must be tagged and filtered by shop. The embedded dashboard
  // scopes to the authenticated session's shop; CLI uploads and device
  // update-checks (which have no session) use this value instead.
  otaShop: (process.env.OTA_SHOP ?? "").trim(),
  // Used when the matching Settings field is blank.
  get trustpilotApiKey() {
    return readEnv("TRUSTPILOT_API_KEY");
  },
  get trustpilotBaseUrl() {
    return readEnv("TRUSTPILOT_BASE_URL");
  },
  get trustpilotBusinessUnitId() {
    return readEnv("TRUSTPILOT_BUSINESS_UNIT_ID");
  },
  get reviewProductHost() {
    return readEnv("REVIEW_PRODUCT_HOST");
  },
};

if (!env.managementToken) {
  console.warn(
    "[ota] MANAGEMENT_TOKEN is not set — CLI /hot-updater bundle uploads and storage routes will reject every request. The embedded dashboard uses the Shopify admin session instead.",
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

if (
  process.env["VERCEL"] &&
  !process.env["BLOB_STORE_ID"] &&
  !process.env["BLOB_READ_WRITE_TOKEN"] &&
  !process.env["BLOB_READ_WRITE_TOKEN_STORE_ID"]
) {
  console.warn(
    "[ota] Running on Vercel without a Blob store. Connect Storage → Blob so BLOB_STORE_ID is created (VERCEL_OIDC_TOKEN is injected automatically). Production OTA deploys MUST use scripts/ota-chunked-storage.mjs in the mobile app — standaloneStorage POSTs the zip through the function and Vercel returns 413 FUNCTION_PAYLOAD_TOO_LARGE.",
  );
}
