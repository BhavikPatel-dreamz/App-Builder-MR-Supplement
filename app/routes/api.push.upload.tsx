import type { ActionFunctionArgs } from "react-router";

import { uploadImage } from "../lib/shopify-files.server";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "../lib/push-validation";
import { authenticate } from "../shopify.server";

/**
 * POST /api/push/upload (multipart/form-data, field name "file")
 * PNG / JPG / WEBP / GIF only, max 2 MB. Verifies the declared MIME type AND
 * the file signature (magic bytes) so a renamed .exe can't slip through.
 * Stores in Shopify Files and returns a public HTTPS URL — never base64.
 */

type SniffResult = { mime: string } | null;

function asciiAt(head: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...head.subarray(start, start + length));
}

/** First-bytes check for the four allowed image types. */
async function sniffImageType(file: File): Promise<SniffResult> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return { mime: "image/png" };
  }
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { mime: "image/jpeg" };
  }
  // GIF: "GIF87a" / "GIF89a" — the 6-byte header, not a "GIF" prefix.
  const gif = asciiAt(head, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") {
    return { mime: "image/gif" };
  }
  // WEBP: "RIFF" at 0 and "WEBP" at byte 8 (both are 4 bytes).
  if (asciiAt(head, 0, 4) === "RIFF" && asciiAt(head, 8, 4) === "WEBP") {
    return { mime: "image/webp" };
  }
  return null;
}

/** Browsers sometimes report JPEG as image/jpg. */
function normalizeImageMime(type: string): string {
  const value = type.trim().toLowerCase();
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  return value;
}

const ALLOWED_MIME = IMAGE_TYPES as readonly string[];

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { ok: false, error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: "A file upload is required." }, { status: 400 });
  }

  if (file.size > IMAGE_MAX_BYTES) {
    return Response.json(
      {
        ok: false,
        error: `“${file.name}” is larger than 2 MB. Choose a smaller image.`,
      },
      { status: 413 },
    );
  }

  const declared = normalizeImageMime(file.type || "");
  if (!ALLOWED_MIME.includes(declared)) {
    return Response.json(
      {
        ok: false,
        error: `“${file.name}” isn’t a supported type. Use PNG, JPG, WEBP or GIF.`,
      },
      { status: 415 },
    );
  }

  const sniffed = await sniffImageType(file);
  // Signature must agree with the declared type, so a renamed file is rejected.
  if (!sniffed || sniffed.mime !== declared) {
    return Response.json(
      { ok: false, error: `“${file.name}” doesn’t look like a valid image file.` },
      { status: 415 },
    );
  }

  // Declared type and signature already agree. Normalise image/jpg → image/jpeg
  // so Shopify receives a consistent MIME.
  const mime = sniffed.mime;
  const normalised =
    file.type === mime ? file : new File([file], file.name, { type: mime });

  try {
    const item = await uploadImage(admin, session.shop, normalised);
    if (!item?.url) {
      throw new Error("Shopify returned no URL for the uploaded file.");
    }
    return Response.json({
      ok: true,
      url: item.url,
      name: file.name,
      size: file.size,
      mimeType: mime,
    });
  } catch (error) {
    console.error("[push] upload failed:", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to upload image.",
      },
      { status: 502 },
    );
  }
};
