import { normalizeUploadFile } from "./media-utils";

export type UploadedMedia = {
  id: string;
  url: string;
  alt?: string;
  title?: string;
  mimeType?: string;
  type?: "image" | "video" | "file";
  width?: number;
  height?: number;
};

type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

type StageResponse = {
  target: StagedTarget;
  contentType: "VIDEO" | "FILE" | "IMAGE";
};

/**
 * Upload a file directly to Shopify storage from the browser.
 *
 * 1. stage    — our server returns a Shopify staged upload target (tiny JSON).
 * 2. upload   — the browser POSTs the file straight to Shopify storage. The
 *               bytes never touch our server, so the Vercel 4.5 MB request-body
 *               limit does not apply (large videos work).
 * 3. finalize — our server registers the file and returns the CDN url.
 */
export async function directUploadMedia(file: File): Promise<UploadedMedia> {
  const normalized = normalizeUploadFile(file);

  // Step 1 — stage
  const stageResponse = await fetch("/api/cms/media?step=stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: normalized.name,
      mimeType: normalized.type,
      fileSize: normalized.size,
    }),
  });
  const stage = (await stageResponse.json().catch(() => ({}))) as
    | StageResponse
    | { error?: string };
  if (!stageResponse.ok || !("target" in stage)) {
    throw new Error(
      ("error" in stage && stage.error) || "Failed to prepare upload.",
    );
  }

  // Step 2 — upload directly to Shopify storage
  const uploadBody = new FormData();
  for (const parameter of stage.target.parameters) {
    uploadBody.append(parameter.name, parameter.value);
  }
  uploadBody.append("file", normalized); // file must be appended last

  const uploadResponse = await fetch(stage.target.url, {
    method: "POST",
    body: uploadBody,
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `Failed to upload file to Shopify storage (${uploadResponse.status}).`,
    );
  }

  // Step 3 — finalize
  const finalizeResponse = await fetch("/api/cms/media?step=finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceUrl: stage.target.resourceUrl,
      filename: normalized.name,
      contentType: stage.contentType,
    }),
  });
  const finalized = (await finalizeResponse.json().catch(() => ({}))) as
    | UploadedMedia
    | { error?: string };
  if (!finalizeResponse.ok || !("url" in finalized) || !finalized.url) {
    throw new Error(
      ("error" in finalized && finalized.error) ||
        "Upload succeeded but no file URL was returned.",
    );
  }

  return finalized;
}
