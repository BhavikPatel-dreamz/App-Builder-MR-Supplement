import { hotUpdater } from "./hotUpdaterInstance.server";
import { requireManagementToken } from "./auth.server";
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
 * Serves a stored bundle byte range from /hot-updater/files/*. This is the
 * URL keyToPublicUrl() embeds in update-check responses, so devices download
 * bundle bytes straight from this server.
 */
async function handleFileServe(rawKey: string): Promise<Response> {
  let key: string;
  try {
    key = assertSafeKey(decodeURIComponent(rawKey));
  } catch {
    return new Response("Not found", { status: 404 });
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
 * Dispatches a /hot-updater/* request: bearer-authed management + storage
 * routes handled here, everything else (update-check, bundle CRUD) delegated
 * to @hot-updater/server's fetch handler. Used directly by the catch-all
 * route and by the authenticated dashboard proxy.
 */
export async function handleOtaRequest(request: Request): Promise<Response> {
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
  if (needsAuth) {
    const authError = requireManagementToken(request);
    if (authError) return withCors(authError);
  }

  let response: Response;
  if (STORAGE_PATHS.has(subPath)) {
    response = await handleStorageRequest(request, subPath);
  } else {
    response = await hotUpdater.handler(request);
    if (UPDATE_CHECK_RE.test(subPath)) {
      await logUpdateCheck(subPath, response);
    }
  }

  return withCors(response);
}
