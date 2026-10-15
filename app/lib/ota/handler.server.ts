import { getScopedHotUpdater } from "./hotUpdaterInstance.server";
import { db } from "./db.server";
import { env } from "./env.server";
import { requireManagementToken } from "./auth.server";
import { usesBlobStorage, blobGet, blobAuthSnapshot, blobListPathnames, runWithOtaRequest } from "./blob.server";
import {
  assertSafeKey,
  contentTypeForKey,
  readFileBytesOrNull,
} from "./storage.server";
import { handleStorageRequest } from "./storageRoutes.server";

const BASE_PATH = "/hot-updater";
const FILES_PREFIX = "/files/";
const STORAGE_PATHS = new Set(["/upload", "/delete", "/readText", "/getDownloadUrl"]);
const UPDATE_CHECK_RE = /^\/(app-version|fingerprint)\//;
const CREATE_BUNDLE_RE = /^\/api\/bundles\/?$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * The bundles/bundle_patches FK to ShopSettings(shop) means a bundle can only
 * be created for a shop that has already been installed (has a settings row).
 * Checked up front on bundle-create so a misconfigured OTA_SHOP surfaces as a
 * clear 409 instead of an opaque "bundles_shop_fkey" 500 from deep inside the
 * library. Uses the unscoped db: ShopSettings is not a tenant table and the
 * shop is filtered explicitly here.
 */
async function shopIsInitialized(shop: string): Promise<boolean> {
  const row = await db
    .selectFrom("ShopSettings")
    .select("shop")
    .where("shop", "=", shop)
    .executeTakeFirst();
  return Boolean(row);
}

/**
 * Logs every update-check hit (platform, appVersion, channel, served bundle
 * id) so you can watch devices hit the server while testing.
 */
async function logUpdateCheck(
  subPath: string,
  response: Response,
): Promise<void> {
  // subPath is "/app-version/{platform}/{appVersion|fingerprint}/{channel}/…"
  // — skip the leading "" and the "app-version"/"fingerprint" segment.
  const [, , platform, appVersionOrFingerprint, channel] = subPath.split("/");
  let servedBundleId = "up-to-date";
  try {
    const body = await response.clone().text();
    const parsed = JSON.parse(body) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed
    ) {
      servedBundleId = String((parsed as { id: unknown }).id);
    }
  } catch {
    // non-JSON body; leave default
  }
  console.log(
    `[update-check] platform=${platform} appVersion=${appVersionOrFingerprint} channel=${channel} servedBundleId=${servedBundleId}`,
  );
}

/**
 * Serves a stored bundle from /hot-updater/files/*. Private Blob objects are
 * streamed with `get()`, same pattern as Vercel's private-storage example.
 */
async function handleFileServe(rawKey: string): Promise<Response> {
  let key: string;
  try {
    key = assertSafeKey(decodeURIComponent(rawKey));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const blob = usesBlobStorage();
  const auth = blob ? await blobAuthSnapshot() : null;
  console.log("[ota] files", { key, blob, ...auth });

  if (blob) {
    try {
      const result = await blobGet(key);
      if (result === null || result.statusCode !== 200 || !result.stream) {
        const prefix = key.split("/")[0] ?? key;
        let listed: string[] = [];
        try {
          listed = await blobListPathnames(prefix);
        } catch (listError) {
          console.warn("[ota] blob list failed", {
            prefix,
            error:
              listError instanceof Error ? listError.message : String(listError),
          });
        }
        console.warn("[ota] blob get miss", {
          key,
          status: result?.statusCode ?? null,
          listed,
        });
        return new Response("Not found", { status: 404 });
      }
      return new Response(result.stream, {
        headers: {
          "Cache-Control": "private, no-cache",
          "Content-Type": result.blob.contentType || contentTypeForKey(key),
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[ota] blob get failed", { key, error: message });
      return new Response(`Blob storage error: ${message}`, { status: 502 });
    }
  }

  const data = await readFileBytesOrNull(key);
  if (data === null) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { "Content-Type": contentTypeForKey(key) },
  });
}

/**
 * Dispatches a /hot-updater/* request. CLI management + storage routes are
 * Bearer-authed with MANAGEMENT_TOKEN here; the DB-backed routes (bundle
 * CRUD + update-check) are delegated to a PER-SHOP @hot-updater/server
 * instance so the shared database stays isolated by shop.
 *
 * The shop is resolved from `opts.shop` (the embedded dashboard passes the
 * authenticated session shop — never a client header) and falls back to
 * OTA_SHOP (CLI uploads + device update-checks). DB routes are fail-closed:
 * with no shop resolved they return 400 rather than touching the database.
 * Storage byte routes (/upload, /files/* …) are content-addressed and stay
 * shop-agnostic.
 *
 * `skipManagementToken` is only set by the dashboard proxy AFTER
 * authenticate.admin succeeds. CLI /hot-updater uploads still require
 * MANAGEMENT_TOKEN.
 */
export async function handleOtaRequest(
  request: Request,
  opts?: { shop?: string; skipManagementToken?: boolean },
): Promise<Response> {
  return runWithOtaRequest(request, () => dispatchOtaRequest(request, opts));
}

async function dispatchOtaRequest(
  request: Request,
  opts?: { shop?: string; skipManagementToken?: boolean },
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const subPath = path.startsWith(BASE_PATH)
    ? path.slice(BASE_PATH.length) || "/"
    : path;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Bundle bytes are public (download URLs are embedded in update-check
  // responses sent to devices), so /files/* needs no bearer token.
  if (subPath.startsWith(FILES_PREFIX)) {
    return withCors(await handleFileServe(subPath.slice(FILES_PREFIX.length)));
  }

  const needsAuth =
    subPath.startsWith("/api") || STORAGE_PATHS.has(subPath);
  // Dashboard proxy sets skipManagementToken only after authenticate.admin
  // and always supplies session.shop. Refuse skip-without-shop so this
  // cannot fall through to OTA_SHOP as an unauthenticated admin.
  if (needsAuth && opts?.skipManagementToken && !(opts.shop ?? "").trim()) {
    return withCors(jsonResponse(401, { error: "Unauthorized" }));
  }
  if (needsAuth && !opts?.skipManagementToken) {
    const authError = requireManagementToken(request);
    if (authError) return withCors(authError);
  }

  // Storage byte operations touch the filesystem, not the tenant tables, so
  // they run unscoped and need no shop.
  if (STORAGE_PATHS.has(subPath)) {
    return withCors(await handleStorageRequest(request, subPath));
  }

  // Everything else (bundle CRUD + update-check) hits the shared bundles /
  // bundle_patches tables and MUST be shop-scoped.
  const shop = (opts?.shop ?? env.otaShop).trim();
  if (!shop) {
    return withCors(
      jsonResponse(400, {
        error:
          "OTA shop could not be resolved. The embedded dashboard uses the authenticated shop; CLI uploads and device update-checks require OTA_SHOP to be set to this app's *.myshopify.com domain.",
      }),
    );
  }

  // Fail with a clear message (not an opaque FK 500) when the shop has no
  // ShopSettings row yet.
  if (request.method === "POST" && CREATE_BUNDLE_RE.test(subPath)) {
    if (!(await shopIsInitialized(shop))) {
      return withCors(
        jsonResponse(409, {
          error: `Shop "${shop}" has no ShopSettings row yet. Open the app once for this shop so its settings are created, then retry the bundle upload.`,
        }),
      );
    }
  }

  const response = await getScopedHotUpdater(shop).handler(request);
  if (UPDATE_CHECK_RE.test(subPath)) {
    await logUpdateCheck(subPath, response);
  }

  return withCors(response);
}
