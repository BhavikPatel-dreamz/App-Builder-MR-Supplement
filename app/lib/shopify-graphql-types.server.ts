import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import type { CacheMode, CacheStatus, CacheTimings } from "./redis-cache.server";

export type GraphQLProxyRequest = {
  shop?: string;
  query: string;
  variables?: Record<string, unknown>;
  cache?: CacheMode;
};

export type GraphQLProxyResponse = {
  data?: unknown;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown; extensions?: unknown }>;
  extensions?: Record<string, unknown>;
};

export type ProxyResult = {
  response: GraphQLProxyResponse;
  cacheStatus: CacheStatus;
  shopifyStatus: number;
  durationMs: number;
  timings?: CacheTimings;
  retryAfterSeconds?: number;
};

export const SHOPIFY_API_VERSION = ApiVersion.April26;

const VALID_CACHE_MODES: CacheMode[] = ["default", "bypass", "refresh"];

export function isValidCacheMode(value: unknown): value is CacheMode {
  return typeof value === "string" && (VALID_CACHE_MODES as string[]).includes(value);
}

export function validateRequest(body: unknown): {
  valid: true;
  parsed: GraphQLProxyRequest;
} | {
  valid: false;
  error: string;
  status: number;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object.", status: 400 };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.query || typeof obj.query !== "string") {
    return { valid: false, error: "query is required and must be a string.", status: 400 };
  }

  if (obj.variables !== undefined) {
    if (typeof obj.variables !== "object" || Array.isArray(obj.variables)) {
      return { valid: false, error: "variables must be an object when provided.", status: 400 };
    }
  }

  if (obj.cache !== undefined && !isValidCacheMode(obj.cache)) {
    return {
      valid: false,
      error: `cache must be one of: ${VALID_CACHE_MODES.join(", ")}. Received "${obj.cache}".`,
      status: 400,
    };
  }

  if (obj.shop !== undefined && typeof obj.shop !== "string") {
    return { valid: false, error: "shop must be a string when provided.", status: 400 };
  }

  return {
    valid: true,
    parsed: {
      shop: typeof obj.shop === "string" ? obj.shop : undefined,
      query: obj.query as string,
      variables: (obj.variables as Record<string, unknown>) ?? undefined,
      cache: (obj.cache as CacheMode) ?? "default",
    },
  };
}
