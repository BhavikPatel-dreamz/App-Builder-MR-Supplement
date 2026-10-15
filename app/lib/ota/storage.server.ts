import path from "node:path";
import { promises as fs } from "node:fs";
import { createRuntimeStoragePlugin } from "@hot-updater/plugin-core";

import {
  blobDel,
  blobGetBytes,
  blobPut,
  currentOtaRequest,
  usesBlobStorage,
} from "./blob.server";
import { env } from "./env.server";

const PROTOCOL = "storage";

/**
 * Keys come from the CLI's standaloneStorage client (arbitrary relative
 * paths like "<bundleId>/bundle.zip"). Reject anything that could escape the
 * store's key namespace before it reaches disk.
 */
export function assertSafeKey(key: string): string {
  const normalized = path.posix
    .normalize(key)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^\/+/, "");
  if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return normalized;
}

export function keyToStorageUri(key: string): string {
  return `${PROTOCOL}://${assertSafeKey(key)}`;
}

/**
 * The CLI computes two different URIs for a content-addressed asset: the
 * *upload* key is always the bundle-independent global prefix
 * "assets/sha256/<shard>" (see hot-updater's deploy task — `uploadKey =
 * ["assets", getRelativeStorageDir(storagePath)].join("/")`, with no
 * bundleId), but the download/exists-check URI it later resolves through
 * `assetBaseStorageUri` is bundle-scoped: "<bundleId>/assets/sha256/<shard>/...".
 * Nothing is ever actually written at the bundle-scoped path, so reads
 * against it 404 unless normalized back to the global path the file really
 * lives at.
 */
function normalizeContentAddressedKey(key: string): string {
  const marker = "assets/sha256/";
  const index = key.indexOf(marker);
  if (index <= 0) return key;
  return key.slice(index);
}

export function storageUriToKey(storageUri: string): string {
  if (!storageUri.startsWith(`${PROTOCOL}://`)) {
    throw new Error(`Unsupported storage URI: ${storageUri}`);
  }
  const key = assertSafeKey(storageUri.slice(`${PROTOCOL}://`.length));
  return normalizeContentAddressedKey(key);
}

function filePathForKey(key: string): string {
  const safeKey = assertSafeKey(key);
  return path.join(env.storageDir, ...safeKey.split("/"));
}

const CONTENT_TYPES: Record<string, string> = {
  ".zip": "application/zip",
  ".json": "application/json",
  ".br": "application/octet-stream",
  ".js": "text/javascript",
  ".map": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".css": "text/css",
  ".html": "text/html",
};

export function contentTypeForKey(key: string): string {
  return (
    CONTENT_TYPES[path.posix.extname(key).toLowerCase()] ??
    "application/octet-stream"
  );
}

function isLocalOrigin(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return true;
  }
}

function originFromRequest(request: Request): string {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || "";
  if (!host) {
    try {
      return new URL(request.url).origin;
    } catch {
      return "";
    }
  }
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

/**
 * Base for phone download links. A localhost PUBLIC_BASE_URL (the local
 * default, often still set on Vercel) would make the app try to download
 * from the phone itself. Prefer the host that actually received the request.
 */
export function publicFileBase(): string {
  const configured = env.publicBaseUrl;
  if (configured && !isLocalOrigin(configured)) return configured;

  const request = currentOtaRequest();
  if (request) {
    const origin = originFromRequest(request);
    if (origin && !isLocalOrigin(origin)) return origin;
  }

  const appUrl = (process.env["SHOPIFY_APP_URL"] ?? "").replace(/\/+$/, "");
  if (appUrl && !isLocalOrigin(appUrl)) return appUrl;

  return configured || "http://localhost:3000";
}

/**
 * Public URL for a key. Private Blob objects are streamed through this
 * server's /hot-updater/files/* route via `get()`, matching the Vercel
 * private-storage pattern (not a public CDN URL).
 */
export function keyToPublicUrl(key: string): string {
  const safeKey = assertSafeKey(key);
  const objectPath = safeKey.split("/").map(encodeURIComponent).join("/");
  return `${publicFileBase()}/hot-updater/files/${objectPath}`;
}

export async function resolvePublicUrl(key: string): Promise<string> {
  return keyToPublicUrl(key);
}

export async function saveFile(key: string, data: Buffer): Promise<void> {
  const safeKey = assertSafeKey(key);
  if (usesBlobStorage()) {
    console.log("[ota] blob put", {
      key: safeKey,
      bytes: data.length,
      hasStoreId: Boolean(process.env["BLOB_STORE_ID"]),
      hasOidc: Boolean(process.env["VERCEL_OIDC_TOKEN"]),
    });
    await blobPut(safeKey, data, contentTypeForKey(safeKey));
    return;
  }
  const filePath = filePathForKey(safeKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

export async function deleteFile(key: string): Promise<void> {
  const safeKey = assertSafeKey(key);
  if (usesBlobStorage()) {
    await blobDel(safeKey);
    return;
  }
  try {
    await fs.unlink(filePathForKey(safeKey));
  } catch (error) {
    // unlink on a missing key throws ENOENT — treat as success, matching the
    // previous del()/Blob behaviour.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readFileTextOrNull(key: string): Promise<string | null> {
  const bytes = await readFileBytesOrNull(key);
  return bytes ? bytes.toString("utf8") : null;
}

export async function readFileBytesOrNull(key: string): Promise<Buffer | null> {
  const safeKey = assertSafeKey(key);
  if (usesBlobStorage()) {
    return blobGetBytes(safeKey);
  }
  try {
    return await fs.readFile(filePathForKey(safeKey));
  } catch {
    return null;
  }
}

/**
 * Server-side "runtime" storage profile: used internally by
 * @hot-updater/server (createHotUpdaterCore) to resolve download URLs and
 * read manifest text when answering update-check requests. This is separate
 * from the /upload,/delete,/readText,/getDownloadUrl handlers in
 * storageRoutes.server.ts, which implement the contract that
 * @hot-updater/standalone's `standaloneStorage` (CLI-side) calls over HTTP.
 */
const createFsRuntimeStorage = createRuntimeStoragePlugin<
  Record<string, never>
>({
  name: "fsStorage",
  supportedProtocol: PROTOCOL,
  factory: () => ({
    getDownloadUrl: async (storageUri: string) => ({
      fileUrl: await resolvePublicUrl(storageUriToKey(storageUri)),
    }),
    readText: async (storageUri: string) => {
      return await readFileTextOrNull(storageUriToKey(storageUri));
    },
  }),
});

export const fsRuntimeStorage = createFsRuntimeStorage({});
