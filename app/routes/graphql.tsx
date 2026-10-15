import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { validateRequest } from "../lib/shopify-graphql-types.server";
import { executeStorefrontRequest } from "../lib/shopify-storefront.server";
import {
  getPersistedQuery,
  setPersistedQuery,
  type CacheMode,
  type CacheTimings,
} from "../lib/redis-cache.server";
import {
  applyCdnCacheHeaders,
  ensureRuntimeCachePolicy,
  publicCacheControlValue,
} from "../lib/cache-policy.server";
import {
  ensureCatalogPersistedQueries,
  lookupPersistedQueryText,
  recordPublicCacheAccess,
  rememberPersistedQueryText,
} from "../lib/cache-store.server";
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
import { lookupCatalogOp, publicQueryCatalog } from "../lib/persisted-queries";
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
 *   GET  /graphql?catalog=1                                        (op → sha256 list)
 *   GET  /graphql?op=productsByCollectionId&variables=…             (no client hash)
 *   GET  /graphql?sha256=<hash>&variables=…
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
  "Access-Control-Expose-Headers":
    "X-Cache, X-Proxy-Duration-Ms, Server-Timing, X-PQ-Fallback, X-PQ-Op, X-PQ-Sha256",
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

function registerQueryPayload(query: string, aliasHash?: string) {
  return (async () => {
    const computed = await setPersistedQuery(query, aliasHash);
    void rememberPersistedQueryText(computed, query);
    if (aliasHash) void rememberPersistedQueryText(aliasHash, query);
    return {
      ok: true,
      sha256: computed,
      alias: aliasHash && aliasHash !== computed ? aliasHash : undefined,
      get: `/graphql?sha256=${aliasHash || computed}&variables={}`,
    };
  })();
}
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
  extras?: { pqFallback?: string; pqAlias?: string; pqOp?: string; pqSha256?: string },
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

  await ensureRuntimeCachePolicy();

  const result = await executeStorefrontRequest(query, variables, mode, { clientIp });
  void recordPublicCacheAccess(request, result.cacheStatus);

  // Register the query so a later `GET ?sha256=<hash>` resolves it. Skip error
  // responses so we don't persist mappings for broken queries. Fire-and-forget.
  if (!(result.response.errors && result.response.errors.length > 0)) {
    void setPersistedQuery(query, extras?.pqAlias).then((hash) => {
      void rememberPersistedQueryText(hash, query);
      if (extras?.pqAlias) void rememberPersistedQueryText(extras.pqAlias, query);
    });
  }

  // GET is CDN-cacheable only for default mode. bypass/refresh must not be
  // stored by Cloudflare — `&cache=bypass` was keeping an old product title.
  const edgeCacheable = cacheable && mode === "default";

  const headers: Record<string, string> = {
    ...corsHeaders({ cacheable: edgeCacheable }),
    "Content-Type": "application/json",
    "Cache-Control": edgeCacheable ? publicCacheControlValue() : "no-store",
    "X-Cache": result.cacheStatus,
    "X-Proxy-Duration-Ms": String(result.durationMs),
  };
  if (edgeCacheable) {
    applyCdnCacheHeaders(headers);
  }
  const timing = serverTiming(result.timings);
  if (timing) headers["Server-Timing"] = timing;
  headers["X-Request-Id"] = requestId;
  headers["X-Circuit-State"] = getCircuitStateForDiagnostics();
  if (extras?.pqFallback) headers["X-PQ-Fallback"] = extras.pqFallback;
  if (extras?.pqOp) headers["X-PQ-Op"] = extras.pqOp;
  if (extras?.pqSha256) headers["X-PQ-Sha256"] = extras.pqSha256;

  const httpStatus = result.shopifyStatus > 0 ? result.shopifyStatus : 200;

  if (httpStatus === 429 || httpStatus === 503) {
    headers["Retry-After"] = String(result.retryAfterSeconds ?? 60);
  }

  console.log(
    JSON.stringify({
      route: "/graphql",
      requestId,
      cache: result.cacheStatus,
      method: request.method,
      sha256: new URL(request.url).searchParams.get("sha256") || undefined,
      cacheable: edgeCacheable,
      shopify: result.cacheStatus === "MISS" || result.cacheStatus === "BYPASS" || result.cacheStatus === "REFRESH",
      shopifyStatus: result.shopifyStatus,
      durationMs: result.durationMs,
      timings: result.timings,
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
  const opName = url.searchParams.get("op") ?? undefined;
  let pqOp: string | undefined;

  const fromOp = lookupCatalogOp(opName);
  if (fromOp) {
    query = fromOp.query;
    pqOp = fromOp.name;
  }

  if (opName && !fromOp) {
    return Response.json(graphQLErrorBody(`Unknown op "${opName}". GET ?catalog=1 for the list.`), {
      status: 400,
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

  // Resolve a persisted-query hash to its query string.
  if (!query && hash) {
    const resolved = await getPersistedQuery(hash);
    if (resolved) {
      query = resolved;
    } else {
      const stored = await lookupPersistedQueryText(hash);
      if (stored) {
        await setPersistedQuery(stored, hash);
        query = stored;
      } else {
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
    }
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

  const cache = url.searchParams.get("cache") ?? "default";
  const validation = validateRequest({ query, variables, cache });
  if (!validation.valid) {
    return Response.json(graphQLErrorBody(validation.error), {
      status: validation.status,
      headers: corsHeaders(),
    });
  }

  const parsed = validation.parsed;
  const extras = {
    ...(hash && url.searchParams.has("query") ? { pqAlias: hash } : {}),
    ...(pqOp ? { pqOp } : {}),
    ...(fromOp ? { pqSha256: fromOp.sha256 } : hash ? { pqSha256: hash } : {}),
  };
  return runAndRespond(
    parsed.query,
    parsed.variables,
    parsed.cache ?? "default",
    true,
    request,
    Object.keys(extras).length ? extras : undefined,
  );
}

// In React Router, only POST/PUT/PATCH/DELETE dispatch to `action`; GET, HEAD
// and OPTIONS all go to `loader`. So CORS preflight (OPTIONS) and the cacheable
// GET read form are both handled here.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await ensureRuntimeCachePolicy();
  void ensureCatalogPersistedQueries();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.get("register") === "1") {
    const query = url.searchParams.get("query") || "";
    const alias = url.searchParams.get("sha256")?.trim();
    const limitErr = validateGraphqlRequestLimits({ query });
    if (!query.trim()) {
      return Response.json(graphQLErrorBody("query is required to register."), {
        status: 400,
        headers: corsHeaders(),
      });
    }
    if (limitErr) {
      return Response.json(graphQLErrorBody(limitErr.error), {
        status: limitErr.status,
        headers: corsHeaders(),
      });
    }
    try {
      await checkGraphqlIpLimit(clientIpFromRequest(request));
    } catch (err) {
      if (err instanceof RateLimitError) {
        return Response.json(graphQLErrorBody(err.message), { status: 429, headers: corsHeaders() });
      }
      throw err;
    }
    const payload = await registerQueryPayload(query, alias);
    return Response.json(payload, { headers: corsHeaders() });
  }
  if (request.method === "GET" && (url.searchParams.get("catalog") === "1" || url.searchParams.get("ops") === "1")) {
    return Response.json(
      { operations: publicQueryCatalog() },
      {
        headers: {
          ...corsHeaders({ cacheable: true }),
          "Cache-Control": "public, max-age=60",
          "Content-Type": "application/json",
        },
      },
    );
  }
  if (
    request.method === "GET" &&
    (url.searchParams.has("query") || url.searchParams.has("sha256") || url.searchParams.has("op"))
  ) {
    return handleGetQuery(url, request);
  }

  return Response.json(
    {
      message:
        "Use GET ?op=productsByCollectionId&variables=…, GET ?sha256=…&variables=…, GET ?catalog=1, or POST { query, variables } / { op, variables }.",
    },
    { headers: CORS_HEADERS },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await ensureRuntimeCachePolicy();
  void ensureCatalogPersistedQueries();

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

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (obj?.register === true) {
    const query = typeof obj.query === "string" ? obj.query : "";
    const alias = typeof obj.sha256 === "string" ? obj.sha256.trim() : undefined;
    const limitErr = validateGraphqlRequestLimits({ query });
    if (!query.trim()) {
      return Response.json(graphQLErrorBody("query is required to register."), {
        status: 400,
        headers: corsHeaders(),
      });
    }
    if (limitErr) {
      return Response.json(graphQLErrorBody(limitErr.error), {
        status: limitErr.status,
        headers: corsHeaders(),
      });
    }
    try {
      await checkGraphqlIpLimit(clientIpFromRequest(request));
    } catch (err) {
      if (err instanceof RateLimitError) {
        return Response.json(graphQLErrorBody(err.message), { status: 429, headers: corsHeaders() });
      }
      throw err;
    }
    const payload = await registerQueryPayload(query, alias);
    return Response.json(payload, { headers: corsHeaders() });
  }
  const fromOp = lookupCatalogOp(typeof obj?.op === "string" ? obj.op : undefined);
  if (typeof obj?.op === "string" && !fromOp) {
    return Response.json(graphQLErrorBody(`Unknown op "${obj.op}". GET ?catalog=1 for the list.`), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
  const validation = validateRequest(
    fromOp ? { ...obj, query: fromOp.query } : body,
  );
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
  const alias =
    body && typeof body === "object" && typeof (body as { sha256?: unknown }).sha256 === "string"
      ? (body as { sha256: string }).sha256.trim()
      : undefined;
  return runAndRespond(
    query,
    variables,
    cache ?? "default",
    false,
    request,
    {
      ...(alias ? { pqAlias: alias } : {}),
      ...(fromOp ? { pqOp: fromOp.name, pqSha256: fromOp.sha256 } : {}),
    },
  );
};
