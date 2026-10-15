/**
 * Vercel Blob via the official SDK (`put` / `get` / `del`).
 *
 * Env is read from `node:process` with dynamic keys (process.env[name]) so
 * Vite cannot inline empty BLOB_* / VERCEL_OIDC_TOKEN values at build time.
 * OIDC is taken from the incoming Vercel request header first — Fluid
 * injects `x-vercel-oidc-token` per invocation and often does not set
 * `VERCEL_OIDC_TOKEN` on process.env.
 *
 * BLOB_WEBHOOK_PUBLIC_KEY is unused (presigned-upload webhooks only).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import nodeProcess from "node:process";
import {
  BlobNotFoundError,
  del,
  get,
  issueSignedToken,
  list,
  presignUrl,
  put,
} from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";

const ACCESS = "private" as const;
const MAX_CLIENT_UPLOAD_BYTES = 512 * 1024 * 1024;
const PRESIGN_TTL_MS = 60 * 60 * 1000;

const otaRequest = new AsyncLocalStorage<Request>();

export function runWithOtaRequest<T>(request: Request, fn: () => T): T {
  return otaRequest.run(request, fn);
}

export function currentOtaRequest(): Request | undefined {
  return otaRequest.getStore();
}

function envFlag(name: string): string | undefined {
  try {
    const value = nodeProcess.env[name];
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

async function resolveOidcToken(): Promise<string | undefined> {
  const fromRequest = otaRequest.getStore()?.headers.get("x-vercel-oidc-token");
  if (fromRequest?.trim()) return fromRequest.trim();

  const fromEnv = envFlag("VERCEL_OIDC_TOKEN");
  if (fromEnv) return fromEnv;

  try {
    const token = (await getVercelOidcToken()).trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

async function blobAuthOptions() {
  const storeId =
    envFlag("BLOB_STORE_ID") || envFlag("BLOB_READ_WRITE_TOKEN_STORE_ID");
  const token = envFlag("BLOB_READ_WRITE_TOKEN");
  const oidcToken = await resolveOidcToken();
  return {
    ...(storeId ? { storeId } : {}),
    ...(oidcToken ? { oidcToken } : {}),
    ...(token ? { token } : {}),
  };
}

export function usesBlobStorage(): boolean {
  return Boolean(
    envFlag("BLOB_STORE_ID") ||
      envFlag("BLOB_READ_WRITE_TOKEN") ||
      envFlag("BLOB_READ_WRITE_TOKEN_STORE_ID") ||
      envFlag("VERCEL"),
  );
}

export async function blobAuthSnapshot() {
  const auth = await blobAuthOptions();
  return {
    hasStoreId: Boolean(auth.storeId),
    hasOidc: Boolean(auth.oidcToken),
    hasRwToken: Boolean(auth.token),
    hasVercel: Boolean(envFlag("VERCEL")),
  };
}

export async function blobPut(
  pathname: string,
  data: Buffer,
  contentType: string,
) {
  return put(pathname, data, {
    ...(await blobAuthOptions()),
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

export async function blobGet(pathname: string) {
  return get(pathname, {
    ...(await blobAuthOptions()),
    access: ACCESS,
    useCache: false,
  });
}

export async function blobDel(pathname: string): Promise<void> {
  try {
    await del(pathname, await blobAuthOptions());
  } catch (error) {
    if (error instanceof BlobNotFoundError) return;
    throw error;
  }
}

export async function blobGetBytes(pathname: string): Promise<Buffer | null> {
  const result = await blobGet(pathname);
  if (result === null || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function blobListPathnames(
  prefix: string,
  limit = 20,
): Promise<string[]> {
  const result = await list({
    ...(await blobAuthOptions()),
    prefix,
    limit,
  });
  return result.blobs.map((blob) => blob.pathname);
}

/**
 * Short-lived PUT URL so the CLI can send bundle bytes straight to Blob and
 * skip the Vercel Function 4.5 MB body cap.
 */
export async function blobPresignPut(
  pathname: string,
): Promise<{ uploadUrl: string; method: "PUT" }> {
  const validUntil = Date.now() + PRESIGN_TTL_MS;
  const auth = await blobAuthOptions();
  // Do not set allowedContentTypes: OTA assets include png/js/json/zip/.br
  // and Blob checks the pathname-inferred type, not only the PUT header.
  const signed = await issueSignedToken({
    ...auth,
    pathname,
    operations: ["put"],
    validUntil,
    maximumSizeInBytes: MAX_CLIENT_UPLOAD_BYTES,
  });
  const { presignedUrl } = await presignUrl(
    {
      clientSigningToken: signed.clientSigningToken,
      delegationToken: signed.delegationToken,
    },
    {
      operation: "put",
      pathname,
      access: ACCESS,
      validUntil,
      allowOverwrite: true,
      addRandomSuffix: false,
      maximumSizeInBytes: MAX_CLIENT_UPLOAD_BYTES,
    },
  );
  return { uploadUrl: presignedUrl, method: "PUT" };
}
