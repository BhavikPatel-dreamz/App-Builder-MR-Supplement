import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { validateRequest } from "../lib/shopify-graphql-types.server";
import { executeStorefrontRequest } from "../lib/shopify-storefront.server";
import {
  getCacheTTL,
  getCacheSWR,
  getPersistedQuery,
  setPersistedQuery,
  type CacheMode,
  type CacheTimings,
} from "../lib/redis-cache.server";
import { ensureCacheWarmerStarted } from "../lib/cache-warmer.server";
import {
  checkGraphqlIpLimit,
  RateLimitError,
} from "../lib/protection/rate-limit.server";
import {
  clientIpFromRequest,
  validateGraphqlRequestLimits,
} from "../lib/protection/graphql-limits.server";
import { getCircuitStateForDiagnostics } from "../lib/protection/circuit-breaker.server";
import { graphQLErrorBody } from "../lib/graphql-response.server";
import { randomUUID } from "crypto";

/**
 * Direct Storefront GraphQL endpoint — no HMAC, no DB lookup.
 *
 * URL: https://appbuilder.dreamzapps.com/graphql
 *
 * Talks straight to Shopify's Storefront API using the public, read-only
 * Storefront token from env, and is CORS-enabled so any browser can call it
 * cross-origin. It reuses the same Redis cache layer (keys namespaced
 * separately).
 *
 * Two request shapes:
 *
 *   POST /graphql            { query, variables?, cache? }        (writes, bypass)
 *   GET  /graphql?query=…&variables=…&cache=…                     (cacheable read)
 *   GET  /graphql?sha256=<hash>&variables=…                       (cacheable read)
 *
 * The GET form exists so a CDN (Cloudflare Mumbai edge) can cache the response
 * by URL — POST is not edge-cacheable. `sha256` is a persisted-query hash: send
 * a full query once (POST or GET) to register it, then reference it by hash for
 * a short, edge-cache-friendly URL. GET and POST share the same origin cache.
 *
 * Note on latency: the origin still runs in the US, so this only beats the
 * India↔US round-trip once a Cloudflare "Cache Everything" rule is caching the
 * GET responses at the Mumbai edge (see docs/graphql-gateway-contract.md).
 */

// This endpoint serves PUBLIC catalog data via a public, read-only Storefront
// token, so any origin is allowed — mirroring how Shopify's own Storefront API
// responds with `access-control-allow-origin: *`. To lock it down to your
// storefront later, replace "*" with a specific origin (or reflect an
// allowlisted request origin); `Vary: Origin` is already set for that case.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // Custom response headers are invisible to cross-origin JS unless exposed.
  "Access-Control-Expose-Headers": "X-Cache, X-Proxy-Duration-Ms, Server-Timing",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/**
 * CORS headers. For cacheable GET responses we drop `Vary: Origin`: the
 * Allow-Origin is a constant `*`, so keeping `Vary: Origin` would only fragment
 * (or block) the Cloudflare edge cache by the request's Origin header.
 */
function corsHeaders(opts?: { cacheable?: boolean }): Record<string, string> {
  if (!opts?.cacheable) return { ...CORS_HEADERS };
  const headers = { ...CORS_HEADERS };
  delete headers.Vary;
  return headers;
}

/** Build a `Server-Timing` value from the per-layer cache timings. */
function serverTiming(timings?: CacheTimings): string {
  if (!timings) return "";
  const parts: string[] = [];
  if (timings.l1Ms > 0) parts.push(`l1;dur=${timings.l1Ms}`);
  if (timings.l2Ms > 0) parts.push(`l2;dur=${timings.l2Ms}`);
  if (timings.fetchMs > 0) parts.push(`shopify;dur=${timings.fetchMs}`);
  parts.push(`total;dur=${timings.totalMs}`);
  return parts.join(", ");
}

/**
 * Execute a validated query and build the HTTP response with cache + timing
 * headers. `cacheable` controls whether the response is edge-cache-friendly
 * (GET) or not (POST).
 */
async function runAndRespond(
  query: string,
  variables: Record<string, unknown> | undefined,
  mode: CacheMode,
  cacheable: boolean,
  request: Request,
): Promise<Response> {
  const requestId = randomUUID().slice(0, 8);
  const clientIp = clientIpFromRequest(request);

  try {
    await checkGraphqlIpLimit(clientIp);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return Response.json(graphQLErrorBody(err.message), {
        status: 429,
        headers: {
          ...corsHeaders({ cacheable: false }),
          "Retry-After": String(err.retryAfterSeconds),
          "X-Request-Id": requestId,
        },
      });
    }
    throw err;
  }

  const result = await executeStorefrontRequest(query, variables, mode, { clientIp });

  // Register the query so a later `GET ?sha256=<hash>` resolves it. Skip error
  // responses so we don't persist mappings for broken queries. Fire-and-forget.
  if (!(result.response.errors && result.response.errors.length > 0)) {
    void setPersistedQuery(query);
  }

  const ttl = getCacheTTL();
  const swr = getCacheSWR();
  const headers: Record<string, string> = {
    ...corsHeaders({ cacheable }),
    "Content-Type": "application/json",
    "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${swr}`,
    "X-Cache": result.cacheStatus,
    "X-Proxy-Duration-Ms": String(result.durationMs),
  };
  const timing = serverTiming(result.timings);
  if (timing) headers["Server-Timing"] = timing;
  headers["X-Request-Id"] = requestId;
  headers["X-Circuit-State"] = getCircuitStateForDiagnostics();

  const httpStatus = result.shopifyStatus > 0 ? result.shopifyStatus : 200;

  if (httpStatus === 429 || httpStatus === 503) {
    headers["Retry-After"] = String(result.retryAfterSeconds ?? 60);
  }

  console.log(
    JSON.stringify({
      route: "/graphql",
      requestId,
      cache: result.cacheStatus,
      shopify: result.cacheStatus === "MISS" || result.cacheStatus === "BYPASS" || result.cacheStatus === "REFRESH",
      shopifyStatus: result.shopifyStatus,
      durationMs: result.durationMs,
      clientIp,
      circuit: getCircuitStateForDiagnostics(),
    }),
  );

  return Response.json(result.response, { status: httpStatus, headers });
}

/** Handle a cacheable GET read: resolve the query (or hash), validate, execute. */
async function handleGetQuery(url: URL, request: Request): Promise<Response> {
  const limitErr = validateGraphqlRequestLimits({
    urlLength: url.toString().length,
    variablesRaw: url.searchParams.get("variables"),
    viaPersistedHash: url.searchParams.has("sha256") && !url.searchParams.has("query"),
  });
  if (limitErr) {
    return Response.json(graphQLErrorBody(limitErr.error), {
      status: limitErr.status,
      headers: corsHeaders(),
    });
  }

  let query = url.searchParams.get("query") ?? undefined;
  const hash = url.searchParams.get("sha256") ?? undefined;

  // Resolve a persisted-query hash to its query string.
  if (!query && hash) {
    const resolved = await getPersistedQuery(hash);
    if (!resolved) {
      // APQ convention: tell the client to resend the full query once. Never
      // cache this — it's a transient "not registered yet" signal.
      return Response.json(
        { errors: [{ message: "PersistedQueryNotFound" }] },
        {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Cache-Control": "no-store",
            "X-Cache": "MISS",
          },
        },
      );
    }
    query = resolved;
  }

  const limitQueryErr = validateGraphqlRequestLimits({
    query,
    viaPersistedHash: Boolean(hash && !url.searchParams.has("query")),
  });
  if (limitQueryErr) {
    return Response.json(graphQLErrorBody(limitQueryErr.error), {
      status: limitQueryErr.status,
      headers: corsHeaders(),
    });
  }

  let variables: Record<string, unknown> | undefined;
  const varsRaw = url.searchParams.get("variables");
  if (varsRaw) {
    try {
      variables = JSON.parse(varsRaw);
    } catch {
      return Response.json(graphQLErrorBody("variables must be valid JSON."), {
        status: 400,
        headers: corsHeaders(),
      });
    }
  }

  const cache = url.searchParams.get("cache") ?? "default";
  const validation = validateRequest({ query, variables, cache });
  if (!validation.valid) {
    return Response.json(graphQLErrorBody(validation.error), {
      status: validation.status,
      headers: corsHeaders(),
    });
  }

  const parsed = validation.parsed;
  return runAndRespond(parsed.query, parsed.variables, parsed.cache ?? "default", true, request);
}

// In React Router, only POST/PUT/PATCH/DELETE dispatch to `action`; GET, HEAD
// and OPTIONS all go to `loader`. So CORS preflight (OPTIONS) and the cacheable
// GET read form are both handled here.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  ensureCacheWarmerStarted();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    (url.searchParams.has("query") || url.searchParams.has("sha256"))
  ) {
    return handleGetQuery(url, request);
  }

  return Response.json(
    {
      message:
        "Use POST with { query, variables?, cache? } — or GET ?query=…&variables=… (or ?sha256=<hash>) — to run a Storefront GraphQL query.",
    },
    { headers: CORS_HEADERS },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  ensureCacheWarmerStarted();

  if (request.method !== "POST") {
    return Response.json(graphQLErrorBody("Method not allowed"), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(graphQLErrorBody("Invalid JSON body."), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return Response.json(graphQLErrorBody(validation.error), {
      status: validation.status,
      headers: CORS_HEADERS,
    });
  }

  const bodyLimit = validateGraphqlRequestLimits({
    query: validation.parsed.query,
    variablesRaw: validation.parsed.variables
      ? JSON.stringify(validation.parsed.variables)
      : null,
  });
  if (bodyLimit) {
    return Response.json(graphQLErrorBody(bodyLimit.error), {
      status: bodyLimit.status,
      headers: corsHeaders(),
    });
  }

  const { query, variables, cache } = validation.parsed;
  return runAndRespond(query, variables, cache ?? "default", false, request);
};
