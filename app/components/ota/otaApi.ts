// Types mirror the actual JSON shape returned by the /hot-updater/api/*
// management routes (via @hot-updater/server), plus the authenticated
// dashboard proxy in app/routes/api.ota.$.tsx.

export interface Bundle {
  id: string;
  platform: "ios" | "android";
  shouldForceUpdate: boolean;
  enabled: boolean;
  fileHash: string;
  storageUri: string;
  gitCommitHash: string | null;
  /** The release note (Hot Updater calls this column `message`). */
  message: string | null;
  channel: string;
  targetAppVersion: string | null;
  fingerprintHash: string | null;
}

/** Kept in step with MAX_NOTE_LENGTH in the ota-app repo's release script. */
export const MAX_RELEASE_NOTE_LENGTH = 1000;

export interface PaginationInfo {
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPage: number;
  totalPages: number;
}

export interface BundlesResponse {
  data: Bundle[];
  pagination: PaginationInfo;
}

export interface ChannelsResponse {
  data: { channels: string[] };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * App Bridge session JWT. Required on Vercel because third-party cookies in
 * the Shopify admin iframe are unreliable, so authenticate.admin needs the
 * Bearer token on these fetches.
 */
async function shopifyIdToken(): Promise<string | null> {
  // App Bridge can lag the first client render inside the admin iframe.
  for (let attempt = 0; attempt < 20; attempt++) {
    const idToken = window.shopify?.idToken;
    if (typeof idToken === "function") {
      try {
        const token = await idToken();
        return typeof token === "string" && token.length > 0 ? token : null;
      } catch {
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const token = await shopifyIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(
      `${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listBundles(
  opts: { channel?: string } = {},
): Promise<BundlesResponse> {
  const params = new URLSearchParams({ limit: "100" });
  if (opts.channel) params.set("channel", opts.channel);
  return request<BundlesResponse>(`/api/ota/bundles?${params.toString()}`);
}

export function listChannels(): Promise<ChannelsResponse> {
  return request<ChannelsResponse>("/api/ota/bundles/channels");
}

export function patchBundle(
  id: string,
  patch: Partial<Pick<Bundle, "enabled" | "shouldForceUpdate" | "message">>,
): Promise<{ success: boolean }> {
  return request(`/api/ota/bundles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteBundle(id: string): Promise<{ success: boolean }> {
  return request(`/api/ota/bundles/${id}`, {
    method: "DELETE",
  });
}

/**
 * Bundle ids are UUIDv7, which embed a 48-bit millisecond timestamp in the
 * first 12 hex characters — decode it instead of inventing a createdAt
 * field the API doesn't return.
 */
export function bundleCreatedAt(bundleId: string): Date | null {
  const hex = bundleId.replace(/-/g, "").slice(0, 12);
  if (hex.length !== 12) return null;
  const ms = Number.parseInt(hex, 16);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}
