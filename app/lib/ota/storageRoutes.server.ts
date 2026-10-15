import {
  deleteFile,
  keyToStorageUri,
  readFileBytesOrNull,
  readFileTextOrNull,
  resolvePublicUrl,
  saveFile,
  storageUriToKey,
} from "./storage.server";

/**
 * Implements the 4-endpoint contract that @hot-updater/standalone's
 * `standaloneStorage` (CLI-side, used from hot-updater.config.ts) calls over
 * HTTP: POST /upload (multipart: file + key) -> { storageUri }, DELETE
 * /delete ({storageUri}) -> 200, POST /readText ({storageUri}) -> raw text,
 * POST /getDownloadUrl ({storageUri}) -> { fileUrl }. None of this is
 * provided by @hot-updater/server itself.
 *
 * Vercel Functions reject bodies over 4.5 MB (platform hard cap). Do not
 * POST bundle.zip through this function. Direct Blob PUT URLs fail from the
 * CLI (`fetch failed`), so `intent=presign` returns 501 and
 * scripts/ota-chunked-storage.mjs uploads the zip in chunks instead.
 */
export async function handleStorageRequest(
  request: Request,
  subPath: string,
): Promise<Response> {
  if (subPath === "/upload") {
    return handleUpload(request);
  }
  if (subPath === "/delete") {
    return handleDelete(request);
  }
  if (subPath === "/readText") {
    return handleReadText(request);
  }
  if (subPath === "/getDownloadUrl") {
    return handleGetDownloadUrl(request);
  }
  return new Response("Not found", { status: 404 });
}

const UPLOAD_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
const MAX_CHUNKS = 200;
const FUNCTION_BODY_SOFT_LIMIT = 3.5 * 1024 * 1024;

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chunkKey(uploadId: string, chunkIndex: number): string {
  return `.chunks/${uploadId}/${chunkIndex}`;
}

function resolveObjectKey(keyPrefix: string, filename: string): string {
  // The CLI sends `key` as a directory prefix and the real leaf filename as
  // the multipart file's own filename — e.g. key="<bundleId>" +
  // filename="bundle.zip"/"manifest.json" (two different files sharing one
  // prefix), or for content-addressed assets key="assets/sha256/9c" +
  // filename="<hash>.br". Treating `key` alone as the literal path makes
  // manifest.json silently overwrite bundle.zip when they share a prefix,
  // and truncates content-addressed asset paths.
  return `${keyPrefix}/${filename}`;
}

const OVERSIZE_UPLOAD_MESSAGE =
  "Vercel Functions reject request bodies over 4.5 MB (FUNCTION_PAYLOAD_TOO_LARGE). Replace standaloneStorage in the mobile app's hot-updater.config.ts with chunkedStandaloneStorage from this repo's scripts/ota-chunked-storage.mjs so the zip is PUT directly to Blob.";

async function handleUpload(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > FUNCTION_BODY_SOFT_LIMIT) {
    return jsonError(413, OVERSIZE_UPLOAD_MESSAGE);
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return handlePresign(request);
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "file");

  if (intent === "chunk") {
    return handleChunk(formData);
  }
  if (intent === "assemble") {
    return handleAssemble(formData);
  }
  if (intent === "presign") {
    return jsonError(
      400,
      'Send intent=presign as JSON ({ "intent":"presign", "key", "filename" }), not multipart.',
    );
  }

  const keyPrefix =
    typeof formData.get("key") === "string"
      ? (formData.get("key") as string)
      : undefined;
  const file = formData.get("file");

  if (!keyPrefix || !(file instanceof File)) {
    return jsonError(400, 'Missing "key" field or "file" upload');
  }

  const key = resolveObjectKey(keyPrefix, file.name);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(key, buffer);
    return new Response(JSON.stringify({ storageUri: keyToStorageUri(key) }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "Bad key",
    );
  }
}

async function handlePresign(request: Request): Promise<Response> {
  let body: { intent?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  if (body.intent !== "presign") {
    return jsonError(400, 'JSON upload requires { "intent": "presign", "key", "filename" }');
  }

  // The CLI plugin treats 501 as "presign unavailable" and uploads in chunks.
  // A direct PUT to the Blob API fails from the deploy machine with
  // `fetch failed`, which aborts the whole deploy.
  return jsonError(
    501,
    "Direct Blob PUT is disabled. Upload in chunks.",
  );
}

async function handleChunk(formData: FormData): Promise<Response> {
  const uploadId = String(formData.get("uploadId") || "");
  const filename = String(formData.get("filename") || "");
  const chunkIndex = Number(formData.get("chunkIndex"));
  const totalChunks = Number(formData.get("totalChunks"));
  const file = formData.get("file");

  if (!UPLOAD_ID_RE.test(uploadId)) {
    return jsonError(400, 'Invalid "uploadId"');
  }
  if (!filename) {
    return jsonError(400, 'Missing "filename"');
  }
  if (
    !Number.isInteger(chunkIndex) ||
    chunkIndex < 0 ||
    !Number.isInteger(totalChunks) ||
    totalChunks < 1 ||
    totalChunks > MAX_CHUNKS ||
    chunkIndex >= totalChunks
  ) {
    return jsonError(400, "Invalid chunkIndex/totalChunks");
  }
  if (!(file instanceof File)) {
    return jsonError(400, 'Missing "file" chunk');
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(chunkKey(uploadId, chunkIndex), buffer);
    return new Response(
      JSON.stringify({
        ok: true,
        received: chunkIndex,
        totalChunks,
        filename,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "Failed to store chunk",
    );
  }
}

async function handleAssemble(formData: FormData): Promise<Response> {
  const uploadId = String(formData.get("uploadId") || "");
  const keyPrefix = String(formData.get("key") || "");
  const filename = String(formData.get("filename") || "");
  const totalChunks = Number(formData.get("totalChunks"));

  if (!UPLOAD_ID_RE.test(uploadId)) {
    return jsonError(400, 'Invalid "uploadId"');
  }
  if (!keyPrefix || !filename) {
    return jsonError(400, 'Missing "key" or "filename"');
  }
  if (
    !Number.isInteger(totalChunks) ||
    totalChunks < 1 ||
    totalChunks > MAX_CHUNKS
  ) {
    return jsonError(400, "Invalid totalChunks");
  }

  const key = resolveObjectKey(keyPrefix, filename);
  const parts: Buffer[] = [];

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const part = await readFileBytesOrNull(chunkKey(uploadId, index));
      if (!part) {
        return jsonError(400, `Missing chunk ${index}/${totalChunks}`);
      }
      parts.push(part);
    }

    await saveFile(key, Buffer.concat(parts));

    await Promise.all(
      Array.from({ length: totalChunks }, (_, index) =>
        deleteFile(chunkKey(uploadId, index)),
      ),
    );

    return new Response(JSON.stringify({ storageUri: keyToStorageUri(key) }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "Failed to assemble upload",
    );
  }
}

async function handleDelete(request: Request): Promise<Response> {
  let storageUri: unknown;
  try {
    storageUri = (await request.json()).storageUri;
  } catch {
    storageUri = undefined;
  }

  if (typeof storageUri !== "string" || !storageUri) {
    return jsonError(400, 'Missing "storageUri"');
  }

  try {
    await deleteFile(storageUriToKey(storageUri));
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "Bad key",
    );
  }
}

async function handleReadText(request: Request): Promise<Response> {
  let storageUri: unknown;
  try {
    storageUri = (await request.json()).storageUri;
  } catch {
    storageUri = undefined;
  }

  if (typeof storageUri !== "string" || !storageUri) {
    return jsonError(400, 'Missing "storageUri"');
  }

  const text = await readFileTextOrNull(storageUriToKey(storageUri));
  if (text === null) {
    return new Response(null, { status: 404 });
  }

  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

async function handleGetDownloadUrl(request: Request): Promise<Response> {
  let storageUri: unknown;
  try {
    storageUri = (await request.json()).storageUri;
  } catch {
    storageUri = undefined;
  }

  if (typeof storageUri !== "string" || !storageUri) {
    return jsonError(400, 'Missing "storageUri"');
  }

  try {
    return new Response(
      JSON.stringify({
        fileUrl: await resolvePublicUrl(storageUriToKey(storageUri)),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "Bad key",
    );
  }
}
