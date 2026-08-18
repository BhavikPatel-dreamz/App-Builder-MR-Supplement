import path from "node:path";
import { promises as fs } from "node:fs";
import { createRuntimeStoragePlugin } from "@hot-updater/plugin-core";

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
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export function contentTypeForKey(key: string): string {
  return (
    CONTENT_TYPES[path.posix.extname(key).toLowerCase()] ??
    "application/octet-stream"
  );
}

/**
 * Public URL for a key, served by this server itself from the storage dir.
 * Deterministic: every `saveFile` stores the key verbatim, so a key maps to
 * exactly one URL and nothing has to be persisted alongside the bundle
 * metadata to resolve downloads.
 */
export function keyToPublicUrl(key: string): string {
  const safeKey = assertSafeKey(key);
  const objectPath = safeKey.split("/").map(encodeURIComponent).join("/");
  return `${env.publicBaseUrl}/hot-updater/files/${objectPath}`;
}

export async function saveFile(key: string, data: Buffer): Promise<void> {
  const filePath = filePathForKey(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await fs.unlink(filePathForKey(key));
  } catch (error) {
    // unlink on a missing key throws ENOENT — treat as success, matching the
    // previous del()/Blob behaviour.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readFileTextOrNull(key: string): Promise<string | null> {
  try {
    return await fs.readFile(filePathForKey(key), "utf8");
  } catch {
    return null;
  }
}

export async function readFileBytesOrNull(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePathForKey(key));
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
      // Devices download bundle bytes from this server's /hot-updater/files/*
      // route, which reads straight from the storage dir.
      fileUrl: keyToPublicUrl(storageUriToKey(storageUri)),
    }),
    readText: async (storageUri: string) => {
      return await readFileTextOrNull(storageUriToKey(storageUri));
    },
  }),
});

export const fsRuntimeStorage = createFsRuntimeStorage({});
