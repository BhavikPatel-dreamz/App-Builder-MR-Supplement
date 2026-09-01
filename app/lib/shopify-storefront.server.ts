// Side-effect: tune the global undici dispatcher (keep-alive pool to Shopify).
import "./http.server";
import {
  buildCacheKey,
  withCache,
  type CacheMode,
} from "./redis-cache.server";
import type {
  GraphQLProxyResponse,
  ProxyResult,
} from "./shopify-graphql-types.server";
import {
  callStorefrontWithProtection,
  CircuitOpenError,
  RateLimitError,
} from "./protection/storefront-fetch.server";
import { getCircuitStateForDiagnostics } from "./protection/circuit-breaker.server";
import {
  graphQLErrorBody,
  resolveGraphqlHttpStatus,
  shouldCacheGraphqlResponse,
} from "./graphql-response.server";

const DEFAULT_STOREFRONT_API_VERSION = "2026-07";

export type StorefrontConfig = {
  domain: string;
  token: string;
  apiVersion: string;
};

export type StorefrontRequestContext = {
  clientIp?: string;
};

export function getStorefrontConfig(): StorefrontConfig | null {
  const domain = process.env.SHOPIFY_STOREFRONT_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) return null;
  return {
    domain,
    token,
    apiVersion:
      process.env.SHOPIFY_STOREFRONT_API_VERSION || DEFAULT_STOREFRONT_API_VERSION,
  };
}

export { CircuitOpenError, RateLimitError };

/**
 * Transparent Shopify Storefront GraphQL gateway.
 *
 * - Passes query + variables to Shopify unmodified
 * - Returns the exact Shopify JSON body `{ data, errors, extensions }`
 * - Caches complete response bodies; HIT responses are byte-identical to MISS
 */
export async function executeStorefrontRequest(
  query: string,
  variables: Record<string, unknown> | undefined,
  mode: CacheMode,
  context: StorefrontRequestContext = {},
): Promise<ProxyResult> {
  const startTime = Date.now();

  const config = getStorefrontConfig();
  if (!config) {
    console.log(
      "[shopify-storefront] ERROR not_configured — set SHOPIFY_STOREFRONT_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN",
    );
    return {
      response: graphQLErrorBody(
        "Storefront API is not configured. Set SHOPIFY_STOREFRONT_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN.",
      ),
      cacheStatus: "MISS",
      shopifyStatus: 0,
      durationMs: Date.now() - startTime,
    };
  }

  const cacheKey = buildCacheKey(`storefront:${config.domain}`, query, variables);
  let lastShopifyHttpStatus = 200;

  try {
    const { data: result, cacheStatus, timings } = await withCache<GraphQLProxyResponse>(
      cacheKey,
      mode,
      async () => {
        const { body, shopifyDurationMs, retryCount, status } =
          await callStorefrontWithProtection(config, {
            query,
            variables,
            clientIp: context.clientIp,
            cacheKey,
          });

        lastShopifyHttpStatus = status;

        console.log(
          JSON.stringify({
            route: "/graphql",
            event: "shopify_fetch",
            cacheKey,
            domain: config.domain,
            shopify: true,
            shopifyDurationMs,
            retryCount,
            httpStatus: status,
            circuit: getCircuitStateForDiagnostics(),
          }),
        );

        // Return Shopify body verbatim — no transformation.
        return body;
      },
      {
        shouldCache: (body) =>
          shouldCacheGraphqlResponse(body as GraphQLProxyResponse, lastShopifyHttpStatus),
        distributed: true,
      },
    );

    const totalDuration = Date.now() - startTime;
    const fromCache = cacheStatus === "HIT" || cacheStatus === "STALE";

    console.log(
      `[shopify-storefront] CACHE=${cacheStatus} domain=${config.domain} total_ms=${totalDuration}`,
    );

    return {
      response: result,
      cacheStatus,
      shopifyStatus: resolveGraphqlHttpStatus(
        fromCache ? 200 : lastShopifyHttpStatus,
        fromCache,
      ),
      durationMs: totalDuration,
      timings,
    };
  } catch (err) {
    const totalDuration = Date.now() - startTime;

    if (err instanceof RateLimitError) {
      return {
        response: graphQLErrorBody(err.message),
        cacheStatus: "MISS",
        shopifyStatus: 429,
        durationMs: totalDuration,
        retryAfterSeconds: err.retryAfterSeconds,
      };
    }

    if (err instanceof CircuitOpenError) {
      return {
        response: graphQLErrorBody(err.message),
        cacheStatus: "MISS",
        shopifyStatus: 503,
        durationMs: totalDuration,
        retryAfterSeconds: err.retryAfterSeconds,
      };
    }

    throw err;
  }
}
