/**
 * Admin push calls go through `/app/push-notifications` (not `/api/push/*`).
 * Cloudflare Bot Fight often challenges `/api/*` JSON POSTs from the embedded
 * admin iframe; `/app/*` is already treated as the Shopify app.
 */
export function pushPageActionUrl(): string {
  if (typeof window === "undefined") return "/app/push-notifications";
  const url = new URL(window.location.href);
  url.pathname = "/app/push-notifications";
  return `${url.pathname}${url.search}`;
}

export function pushUploadUrl(): string {
  if (typeof window === "undefined") return "/api/push/upload";
  const url = new URL(window.location.href);
  url.pathname = "/api/push/upload";
  return `${url.pathname}${url.search}`;
}
