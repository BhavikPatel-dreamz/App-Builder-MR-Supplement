export type MediaLike = {
  type?: string | null;
  mimeType?: string | null;
  mime?: string | null;
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  // video
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  ts: "video/mp2t",
  // audio
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  weba: "audio/webm",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  // image
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
};

function getExtension(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot < 0 || lastDot === normalized.length - 1) {
    return "";
  }
  return normalized.slice(lastDot + 1);
}

export function inferMimeTypeFromFilename(filename: string): string | undefined {
  const extension = getExtension(filename);
  return EXTENSION_MIME_MAP[extension];
}

export function resolveUploadMimeType(
  file: Pick<File, "name" | "type">,
): string {
  const currentType = (file.type || "").trim().toLowerCase();
  if (currentType && currentType !== "application/octet-stream") {
    return currentType;
  }
  return inferMimeTypeFromFilename(file.name) || "application/octet-stream";
}

export function normalizeUploadFile(file: File): File {
  const resolvedType = resolveUploadMimeType(file);
  if (resolvedType === file.type) {
    return file;
  }
  return new File([file], file.name, {
    type: resolvedType,
    lastModified: file.lastModified,
  });
}

export function isVideoLikeMedia(media?: MediaLike | null): boolean {
  if (!media) return false;
  const type = (media.type || "").toLowerCase();
  const mimeType = (media.mimeType || "").toLowerCase();
  const mime = (media.mime || "").toLowerCase();
  return (
    type === "video" ||
    type.startsWith("video/") ||
    mimeType.startsWith("video/") ||
    mime.startsWith("video/")
  );
}

export function isAudioLikeMedia(media?: MediaLike | null): boolean {
  if (!media) return false;
  const type = (media.type || "").toLowerCase();
  const mimeType = (media.mimeType || "").toLowerCase();
  const mime = (media.mime || "").toLowerCase();
  return (
    type === "audio" ||
    type.startsWith("audio/") ||
    mimeType.startsWith("audio/") ||
    mime.startsWith("audio/")
  );
}
