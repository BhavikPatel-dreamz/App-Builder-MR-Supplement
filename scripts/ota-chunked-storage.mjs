/**
 * 1:1 replacement for `@hot-updater/standalone`'s `standaloneStorage`.
 *
 * Copy this file into the RN app root (next to hot-updater.config.ts).
 * Then change ONLY the storage import/call:
 *
 *   - import { standaloneStorage } from "@hot-updater/standalone";
 *   + import { standaloneStorage } from "./ota-chunked-storage.mjs";
 *
 * Leave the `standaloneStorage({ baseUrl, commonHeaders })` call as-is.
 *
 * Proof it is active: the deploy spinner says
 *   "Uploading to Storage (iOS • chunkedStandaloneStorage)"
 * Official plugin says "standaloneStorage" and 413s on Vercel.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const CHUNK_SIZE_BYTES = 1024 * 1024;
const DIRECT_UPLOAD_MAX_BYTES = 1024 * 1024;

const defaultRoutes = {
  upload: () => ({ path: "/upload" }),
  delete: () => ({ path: "/delete" }),
  readText: () => ({ path: "/readText" }),
  getDownloadUrl: () => ({ path: "/getDownloadUrl" }),
};

function createRoute(defaultRoute, customRoute) {
  return {
    path: customRoute?.path ?? defaultRoute.path,
    headers: {
      ...defaultRoute.headers,
      ...customRoute?.headers,
    },
  };
}

export function chunkedStandaloneStorage(config, hooks) {
  return standaloneStorage(config, hooks);
}

/** Same name as the official plugin so existing configs can swap the import only. */
export function standaloneStorage(config, hooks) {
  const baseUrl = String(config.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error(
      "chunkedStandaloneStorage: baseUrl is required (HOT_UPDATER_SERVER_URL ending in /hot-updater)",
    );
  }

  const routes = {
    upload: (key, filePath) =>
      createRoute(
        defaultRoutes.upload(),
        config.routes?.upload?.(key, filePath),
      ),
    delete: (storageUri) =>
      createRoute(defaultRoutes.delete(), config.routes?.delete?.(storageUri)),
    readText: (storageUri) =>
      createRoute(
        defaultRoutes.readText(),
        config.routes?.readText?.(storageUri),
      ),
    getDownloadUrl: (storageUri) =>
      createRoute(
        defaultRoutes.getDownloadUrl(),
        config.routes?.getDownloadUrl?.(storageUri),
      ),
  };

  const getHeaders = (routeHeaders) => ({
    ...config.commonHeaders,
    ...routeHeaders,
  });

  console.log(
    "[ota] chunkedStandaloneStorage v4 — 1MB chunks, skip missing-file check",
  );

  function multipartBody(fields, file) {
    const boundary = `----ota${crypto.randomUUID().replace(/-/g, "")}`;
    const parts = [];
    for (const [name, value] of Object.entries(fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        ),
      );
    }
    if (file) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
        ),
      );
      parts.push(Buffer.from(file.data));
      parts.push(Buffer.from("\r\n"));
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    return {
      body: Buffer.concat(parts),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  async function postMultipart(pathname, fields, routeHeaders, file) {
    const { body, contentType } = multipartBody(fields, file);
    const url = `${baseUrl}${pathname}`;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await fetch(url, {
          method: "POST",
          headers: {
            ...getHeaders(routeHeaders),
            "Content-Type": contentType,
            "Content-Length": String(body.byteLength),
          },
          body,
        });
      } catch (error) {
        const cause =
          error instanceof Error && error.cause instanceof Error
            ? `${error.message}: ${error.cause.message}`
            : error instanceof Error
              ? error.message
              : String(error);
        lastError = cause;
        console.warn(
          `[ota] upload attempt ${attempt}/3 failed (${cause})`,
        );
      }
    }
    throw new Error(`Upload request failed: ${lastError}`);
  }

  async function uploadDirect(key, filePath, contentType, filename, routeHeaders) {
    const fileContent = await fs.readFile(filePath);
    const { path: routePath } = routes.upload(key, filePath);
    const response = await postMultipart(
      routePath,
      { key },
      routeHeaders,
      { filename, contentType, data: fileContent },
    );
    if (!response.ok) {
      const error = `Failed to upload bundle: ${response.status} ${response.statusText}`;
      console.error(`[upload] ${error}`);
      throw new Error(error);
    }
    return response.json();
  }

  async function uploadChunked(key, filePath, contentType, filename, routeHeaders) {
    const fileContent = await fs.readFile(filePath);
    const totalChunks = Math.ceil(fileContent.byteLength / CHUNK_SIZE_BYTES);
    const uploadId = crypto.randomUUID();
    const { path: routePath } = routes.upload(key, filePath);

    console.log(
      `[ota] chunked upload ${filename} (${fileContent.byteLength} bytes, ${totalChunks} parts)`,
    );

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, fileContent.byteLength);
      const response = await postMultipart(
        routePath,
        {
          intent: "chunk",
          uploadId,
          chunkIndex: String(chunkIndex),
          totalChunks: String(totalChunks),
          key,
          filename,
        },
        routeHeaders,
        {
          filename: `${filename}.part${chunkIndex}`,
          contentType,
          data: fileContent.subarray(start, end),
        },
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Failed to upload bundle chunk ${chunkIndex + 1}/${totalChunks}: ${response.status} ${detail || response.statusText}`,
        );
      }
      console.log(
        `[ota] chunk ${chunkIndex + 1}/${totalChunks} stored`,
      );
    }

    const response = await postMultipart(
      routePath,
      {
        intent: "assemble",
        uploadId,
        totalChunks: String(totalChunks),
        key,
        filename,
      },
      routeHeaders,
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Failed to assemble bundle: ${response.status} ${detail || response.statusText}`,
      );
    }
    return response.json();
  }

  async function getDownloadUrl(storageUri) {
    const { path: routePath, headers: routeHeaders } =
      routes.getDownloadUrl(storageUri);
    const response = await fetch(`${baseUrl}${routePath}`, {
      method: "POST",
      headers: {
        ...getHeaders(routeHeaders),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storageUri }),
    });
    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.statusText}`);
    }
    return { fileUrl: (await response.json()).fileUrl };
  }

  return () => ({
    name: "chunkedStandaloneStorage",
    supportedProtocol: "http",
    profiles: {
      node: {
        async delete(storageUri) {
          const { path: routePath, headers: routeHeaders } =
            routes.delete(storageUri);
          const response = await fetch(`${baseUrl}${routePath}`, {
            method: "DELETE",
            headers: getHeaders(routeHeaders),
            body: JSON.stringify({ storageUri }),
          });
          if (!response.ok) {
            throw new Error(`Failed to delete bundle: ${response.statusText}`);
          }
        },
        async upload(key, filePath) {
          const filename = path.basename(filePath);
          const stat = await fs.stat(filePath);
          const contentType = "application/octet-stream";
          const { headers: routeHeaders } = routes.upload(key, filePath);

          const result =
            stat.size <= DIRECT_UPLOAD_MAX_BYTES
              ? await uploadDirect(
                  key,
                  filePath,
                  contentType,
                  filename,
                  routeHeaders,
                )
              : await uploadChunked(
                  key,
                  filePath,
                  contentType,
                  filename,
                  routeHeaders,
                );

          if (!result?.storageUri) {
            throw new Error(
              "Failed to upload bundle - no storageUri in response",
            );
          }

          await hooks?.onStorageUploaded?.();
          return { storageUri: result.storageUri };
        },
        async exists(storageUri) {
          // bundle.zip is already stored before this runs. The CLI then asks
          // whether each asset exists. A failed HEAD used to abort the deploy
          // with "fetch failed", so a check error means "upload the file".
          try {
            const { fileUrl } = await getDownloadUrl(storageUri);
            const response = await fetch(fileUrl, {
              method: "GET",
              headers: { Range: "bytes=0-0" },
            });
            await response.body?.cancel();
            return response.ok || response.status === 206;
          } catch (error) {
            const cause =
              error instanceof Error && error.cause instanceof Error
                ? error.cause.message
                : error instanceof Error
                  ? error.message
                  : String(error);
            console.warn(
              `[ota] exists check failed, uploading anyway (${cause})`,
            );
            return false;
          }
        },
        async downloadFile(storageUri, filePath) {
          const { fileUrl } = await getDownloadUrl(storageUri);
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to download bundle: ${response.statusText}`);
          }
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(
            filePath,
            new Uint8Array(await response.arrayBuffer()),
          );
        },
      },
      runtime: {
        async readText(storageUri) {
          const { path: routePath, headers: routeHeaders } =
            routes.readText(storageUri);
          const response = await fetch(`${baseUrl}${routePath}`, {
            method: "POST",
            headers: getHeaders(routeHeaders),
            body: JSON.stringify({ storageUri }),
          });
          if (!response.ok) return null;
          return response.text();
        },
        getDownloadUrl,
      },
    },
  });
}

export default standaloneStorage;
