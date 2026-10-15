/**
 * Push notification validation rules — shared by the browser form and the
 * server routes so both enforce exactly the same limits. The server never
 * trusts these results on their own; it re-runs them on every request.
 */

export const TITLE_MAX = 65;
export const MESSAGE_MAX = 240;
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
/** Allowed custom scheme for in-app links. */
export const APP_SCHEME = "mrsupplement";
/** Schemes that must never be accepted even if they parse as URLs. */
const BLOCKED_SCHEMES = ["javascript", "data", "file", "vbscript"];

export type PushFormInput = {
  title: string;
  message: string;
  deeplink: string;
  imageUrl?: string;
  imageName?: string;
  imageSize?: number;
  deviceToken?: string;
};

export type PushFieldErrors = Partial<
  Record<"title" | "message" | "deeplink" | "imageUrl" | "deviceToken", string>
>;

export function validateTitle(value: string): string {
  const t = value.trim();
  if (!t) return "Enter a title.";
  if (t.length > TITLE_MAX)
    return `Shorten the title to ${TITLE_MAX} characters or fewer (currently ${t.length}).`;
  return "";
}

export function validateMessage(value: string): string {
  const t = value.trim();
  if (!t) return "Enter a message.";
  if (t.length > MESSAGE_MAX)
    return `Shorten the message to ${MESSAGE_MAX} characters or fewer (currently ${t.length}).`;
  return "";
}

/**
 * Deeplink rules: empty is allowed (opens the app home screen), no whitespace
 * anywhere, and only https://, http:// with a real domain, or mrsupplement://.
 * javascript:, data:, file: and vbscript: are explicitly rejected.
 */
export function validateDeeplink(value: string): string {
  const t = value.trim();
  if (!t) return "";
  // Reject whitespace anywhere (including control chars the URL parser allows).
  if (/\s/.test(t)) return "Remove spaces from the URL.";
  let parsed: URL;
  try {
    parsed = new URL(t);
  } catch {
    return `Enter a full URL, such as https://www.mrsupplement.com.au/products/… or ${APP_SCHEME}://products/123.`;
  }
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (BLOCKED_SCHEMES.includes(scheme)) return "This URL type isn’t allowed.";
  if (scheme === "http" || scheme === "https") {
    // Require a dotted domain (rejects "https://localhost" style values).
    return parsed.hostname.includes(".")
      ? ""
      : "Enter a web URL with a valid domain.";
  }
  if (scheme !== APP_SCHEME) return `App links must start with ${APP_SCHEME}://`;
  return "";
}

/**
 * Image URL checks for the send path — the URL must come from our upload
 * route, but we still verify it is a plain https URL (no data:/javascript:).
 */
export function validateImageUrl(value: string): string {
  const t = value.trim();
  if (!t) return "";
  let parsed: URL;
  try {
    parsed = new URL(t);
  } catch {
    return "Image URL is not a valid URL.";
  }
  if (parsed.protocol !== "https:") return "Image URL must use https://.";
  return "";
}

/**
 * Optional FCM registration token for a one-device test send.
 * Empty = send to the topic. Tokens are long opaque strings with no spaces.
 */
export function validateDeviceToken(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (/\s/.test(t)) return "Remove spaces from the device token.";
  if (t.length < 32) return "That doesn’t look like an FCM device token.";
  if (t.length > 4096) return "Device token is too long.";
  if (!/^[A-Za-z0-9_:\-\.]+$/.test(t)) {
    return "Device token contains invalid characters.";
  }
  return "";
}

/** Client-side file gate before uploading (the server re-checks everything). */
export function validateImageFile(file: {
  name: string;
  size: number;
  type: string;
}): string {
  const allowed = IMAGE_TYPES as readonly string[];
  if (!allowed.includes((file.type || "").toLowerCase())) {
    return `“${file.name}” isn’t a supported type. Use PNG, JPG, WEBP or GIF.`;
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)}. Choose an image under 2 MB.`;
  }
  return "";
}

/** Full validation pass; returns per-field messages (empty object = valid). */
export function validatePushInput(input: PushFormInput): PushFieldErrors {
  const errors: PushFieldErrors = {};
  const title = validateTitle(input.title);
  if (title) errors.title = title;
  const message = validateMessage(input.message);
  if (message) errors.message = message;
  const deeplink = validateDeeplink(input.deeplink);
  if (deeplink) errors.deeplink = deeplink;
  const imageUrl = validateImageUrl(input.imageUrl || "");
  if (imageUrl) errors.imageUrl = imageUrl;
  const deviceToken = validateDeviceToken(input.deviceToken || "");
  if (deviceToken) errors.deviceToken = deviceToken;
  return errors;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
