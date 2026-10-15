import type { GraphQLProxyResponse } from "../shopify-graphql-types.server";
import { protectionConfig } from "./config.server";
import {
  assertCircuitClosed,
  recordShopifyFailure,
  recordShopifySuccess,
  CircuitOpenError,
} from "./circuit-breaker.server";
import {
  checkLocalShopifyFallbackLimit,
  checkShopifyOutboundLimits,
  RateLimitError,
  type RateLimitContext,
} from "./rate-limit.server";

export { CircuitOpenError, RateLimitError };

export type StorefrontFetchConfig = {
  domain: string;
  token: string;
  apiVersion: string;
};

export type StorefrontFetchResult = {
  status: number;
  body: GraphQLProxyResponse;
  shopifyDurationMs: number;
  retryCount: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 30_000);
  return base + Math.floor(Math.random() * 500);
}

function isRetryableHttp(status: number): boolean {
  return status === 429 || status >= 500;
}

function isGraphqlThrottled(body: GraphQLProxyResponse): boolean {
  return (
    Array.isArray(body.errors) &&
    body.errors.some(
      (e) =>
        e.message?.toLowerCase().includes("throttled") ||
        (e.extensions as { code?: string } | undefined)?.code === "THROTTLED",
    )
  );
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }
  return undefined;
}

export type StorefrontCallOptions = RateLimitContext & {
  query: string;
  variables?: Record<string, unknown>;
};

/**
 * Protected Shopify Storefront fetch — rate limits, circuit breaker, timeout, retries.
 */
export async function callStorefrontWithProtection(
  config: StorefrontFetchConfig,
  options: StorefrontCallOptions,
): Promise<StorefrontFetchResult> {
  await checkShopifyOutboundLimits({
    clientIp: options.clientIp,
    cacheKey: options.cacheKey,
  });
  await checkLocalShopifyFallbackLimit();
  await assertCircuitClosed();

  const url = `https://${config.domain}/api/${config.apiVersion}/graphql.json`;
  const maxRetries = protectionConfig.storefront.maxRetries;
  let retryCount = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const shopifyStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        protectionConfig.storefront.timeoutMs,
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Shopify-Storefront-Access-Token": config.token,
        },
        body: JSON.stringify({ query: options.query, variables: options.variables }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const shopifyDurationMs = Date.now() - shopifyStart;
      const body = (await response.json()) as GraphQLProxyResponse;

      if (!response.ok) {
        if (isRetryableHttp(response.status) && attempt < maxRetries) {
          retryCount += 1;
          const retryAfter =
            parseRetryAfter(response.headers.get("Retry-After")) ??
            jitteredBackoff(attempt) / 1000;
          console.warn(
            `[shopify-storefront] HTTP ${response.status} — retry ${retryCount}/${maxRetries} after ${retryAfter}s`,
          );
          await sleep(retryAfter * 1000);
          continue;
        }
        await recordShopifyFailure();
        return { status: response.status, body, shopifyDurationMs, retryCount };
      }

      if (isGraphqlThrottled(body) && attempt < maxRetries) {
        retryCount += 1;
        await sleep(jitteredBackoff(attempt));
        continue;
      }

      if (body.errors?.length) {
        /* GraphQL field errors are not infrastructure failures — do not trip CB. */
        return { status: response.status, body, shopifyDurationMs, retryCount };
      }

      await recordShopifySuccess();
      return { status: response.status, body, shopifyDurationMs, retryCount };
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("fetch"));
      if (retryable && attempt < maxRetries) {
        retryCount += 1;
        await recordShopifyFailure();
        await sleep(jitteredBackoff(attempt));
        continue;
      }
      await recordShopifyFailure();
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Shopify Storefront request failed");
}
