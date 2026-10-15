/**
 * GraphQL response helpers — keep /graphql compatible with Shopify Storefront API.
 *
 * The response BODY must always be `{ data?, errors?, extensions? }`.
 * Infrastructure metadata belongs in HTTP headers only (X-Cache, Retry-After, etc.).
 */

export type GraphQLErrorShape = {
  message: string;
  locations?: unknown;
  path?: unknown;
  extensions?: unknown;
};

export type GraphQLResponseBody = {
  data?: unknown;
  errors?: GraphQLErrorShape[];
  extensions?: Record<string, unknown>;
};

/** Build a Shopify-compatible GraphQL error body (no custom REST `{ error: }` wrapper). */
export function graphQLErrorBody(message: string): GraphQLResponseBody {
  return { errors: [{ message }] };
}

export function graphQLErrorBodies(messages: string[]): GraphQLResponseBody {
  return { errors: messages.map((message) => ({ message })) };
}

/** Deep equality for contract tests (JSON-serializable values). */
export function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Whether a Shopify GraphQL response body should be cached.
 * - Cache successful responses with data
 * - Do NOT cache GraphQL errors (prevents poisoning CDN/Redis)
 */
export function shouldCacheGraphqlResponse(
  body: GraphQLResponseBody,
  httpStatus: number,
): boolean {
  if (httpStatus !== 200) return false;
  if (Array.isArray(body.errors) && body.errors.length > 0) return false;
  return true;
}

/**
 * Resolve HTTP status for the client response.
 * Shopify Storefront GraphQL typically returns 200 even when `errors` is present.
 * Preserve non-200 HTTP statuses from Shopify; gateway infra errors use 429/503.
 */
export function resolveGraphqlHttpStatus(
  shopifyHttpStatus: number,
  fromCache: boolean,
): number {
  if (fromCache) return 200;
  if (shopifyHttpStatus > 0) return shopifyHttpStatus;
  return 200;
}
