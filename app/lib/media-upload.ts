import { normalizeUploadFile } from "./media-utils";

type MediaUploadResult = {
  id: string;
  url: string;
  alt?: string;
  title?: string;
  mimeType?: string;
  type?: "image" | "video" | "file";
  width?: number;
  height?: number;
};

/** Stay under Vercel’s 4.5 MB function body limit (multipart overhead included). */
const DIRECT_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 2.5 * 1024 * 1024;

async function readErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}));
  return (
    (payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: string }).error || "")
      : "") || fallback
  );
}

async function uploadDirect(file: File): Promise<MediaUploadResult> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/cms/media", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to upload media."));
  }

  const item = (await response.json()) as MediaUploadResult;
  if (!item?.url) {
    throw new Error("Upload succeeded but no file URL was returned.");
  }
  return item;
}

async function uploadChunked(file: File): Promise<MediaUploadResult> {
  const uploadId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
    const blob = file.slice(start, end);

    const body = new FormData();
    body.append("intent", "chunk");
    body.append("uploadId", uploadId);
    body.append("chunkIndex", String(chunkIndex));
    body.append("totalChunks", String(totalChunks));
    body.append("filename", file.name);
    body.append("mimeType", file.type || "application/octet-stream");
    body.append("chunk", blob, `${file.name}.part${chunkIndex}`);

    const response = await fetch("/api/cms/media", {
      method: "POST",
      body,
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}.`,
        ),
      );
    }
  }

  const assembleResponse = await fetch("/api/cms/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "assemble",
      uploadId,
    }),
  });

  if (!assembleResponse.ok) {
    throw new Error(
      await readErrorMessage(assembleResponse, "Failed to finalize media upload."),
    );
  }

  const item = (await assembleResponse.json()) as MediaUploadResult;
  if (!item?.url) {
    throw new Error("Upload succeeded but no file URL was returned.");
  }
  return item;
}

/**
 * Upload media to Shopify Files.
 * Large files are split into chunks so uploads work on Vercel (4.5 MB body limit).
 */
export async function uploadMediaViaStagedUpload(
  file: File,
): Promise<MediaUploadResult> {
  const normalizedFile = normalizeUploadFile(file);

  if (normalizedFile.size <= DIRECT_UPLOAD_MAX_BYTES) {
    return uploadDirect(normalizedFile);
  }

  return uploadChunked(normalizedFile);
}
