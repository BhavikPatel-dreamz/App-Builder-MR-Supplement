import {
  deleteFile,
  keyToPublicUrl,
  keyToStorageUri,
  readFileTextOrNull,
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

async function handleUpload(request: Request): Promise<Response> {
  const formData = await request.formData();
  const keyPrefix =
    typeof formData.get("key") === "string"
      ? (formData.get("key") as string)
      : undefined;
  const file = formData.get("file");

  if (!keyPrefix || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: 'Missing "key" field or "file" upload' }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // The CLI sends `key` as a directory prefix and the real leaf filename as
  // the multipart file's own filename — e.g. key="<bundleId>" +
  // filename="bundle.zip"/"manifest.json" (two different files sharing one
  // prefix), or for content-addressed assets key="assets/sha256/9c" +
  // filename="<hash>.br". Treating `key` alone as the literal path makes
  // manifest.json silently overwrite bundle.zip when they share a prefix,
  // and truncates content-addressed asset paths.
  const key = `${keyPrefix}/${file.name}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(key, buffer);
    return new Response(JSON.stringify({ storageUri: keyToStorageUri(key) }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Bad key",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
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
    return new Response(
      JSON.stringify({ error: 'Missing "storageUri"' }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    await deleteFile(storageUriToKey(storageUri));
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Bad key",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
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
    return new Response(
      JSON.stringify({ error: 'Missing "storageUri"' }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
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
    return new Response(
      JSON.stringify({ error: 'Missing "storageUri"' }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Points directly at Blob's public CDN.
  try {
    return new Response(
      JSON.stringify({ fileUrl: keyToPublicUrl(storageUriToKey(storageUri)) }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Bad key",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
