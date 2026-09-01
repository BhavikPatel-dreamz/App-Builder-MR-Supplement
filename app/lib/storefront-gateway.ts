/**
 * Client helper: GET /graphql?sha256=…&variables=… (edge-cacheable Storefront gateway).
 *
 * Use from mobile app, theme JS, or React Native — no Shopify token in the client.
 */

import {
  PRODUCTS_BY_COLLECTION_ID_QUERY,
  PRODUCTS_BY_COLLECTION_ID_SHA256,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_BY_HANDLE_SHA256,
  type PersistedQueryEntry,
} from "./persisted-queries";

export const DEFAULT_GATEWAY_URL = "https://appbuilder.dreamzapps.com/graphql";

export type StorefrontGraphQLResponse<T = unknown> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export type GatewayFetchOptions = {
  /** Defaults to https://appbuilder.dreamzapps.com/graphql */
  gatewayUrl?: string;
  /** Full query string — used to auto-register hash on PersistedQueryNotFound */
  query?: string;
  /** @default true */
  registerOnMiss?: boolean;
  fetchInit?: RequestInit;
};

export function buildPersistedQueryUrl(
  sha256: string,
  variables: Record<string, unknown>,
  gatewayUrl = DEFAULT_GATEWAY_URL,
): string {
  const params = new URLSearchParams();
  params.set("sha256", sha256);
  params.set("variables", JSON.stringify(variables));
  return `${gatewayUrl}?${params.toString()}`;
}

export function buildFullQueryUrl(
  query: string,
  variables: Record<string, unknown>,
  gatewayUrl = DEFAULT_GATEWAY_URL,
): string {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("variables", JSON.stringify(variables));
  return `${gatewayUrl}?${params.toString()}`;
}

function isPersistedQueryNotFound(json: StorefrontGraphQLResponse): boolean {
  return (
    Array.isArray(json.errors) &&
    json.errors.some((e) => String(e.message).includes("PersistedQueryNotFound"))
  );
}

/**
 * Fetch via persisted query hash (GET). Registers query once if missing on server.
 */
export async function fetchPersistedQuery<T = unknown>(
  entry: Pick<PersistedQueryEntry, "sha256" | "query">,
  variables: Record<string, unknown>,
  options: GatewayFetchOptions = {},
): Promise<StorefrontGraphQLResponse<T>> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const registerOnMiss = options.registerOnMiss !== false;
  const query = options.query ?? entry.query;

  let url = buildPersistedQueryUrl(entry.sha256, variables, gatewayUrl);
  let res = await fetch(url, {
    cache: "default",
    ...options.fetchInit,
  });
  let json = (await res.json()) as StorefrontGraphQLResponse<T>;

  if (registerOnMiss && isPersistedQueryNotFound(json) && query) {
    url = buildFullQueryUrl(query, variables, gatewayUrl);
    res = await fetch(url, { cache: "no-store", ...options.fetchInit });
    json = (await res.json()) as StorefrontGraphQLResponse<T>;
  }

  return json;
}

/** Collection PLP — drop-in replacement for direct Shopify Storefront POST. */
export async function fetchCollectionProducts<T = unknown>(
  collectionGid: string,
  first = 250,
  options: GatewayFetchOptions = {},
): Promise<StorefrontGraphQLResponse<T>> {
  return fetchPersistedQuery(
    {
      sha256: PRODUCTS_BY_COLLECTION_ID_SHA256,
      query: PRODUCTS_BY_COLLECTION_ID_QUERY,
    },
    { id: collectionGid, first },
    options,
  );
}

/** Product PDP by handle. */
export async function fetchProductByHandle<T = unknown>(
  handle: string,
  options: GatewayFetchOptions = {},
): Promise<StorefrontGraphQLResponse<T>> {
  return fetchPersistedQuery(
    {
      sha256: PRODUCT_BY_HANDLE_SHA256,
      query: PRODUCT_BY_HANDLE_QUERY,
    },
    { handle },
    options,
  );
}
