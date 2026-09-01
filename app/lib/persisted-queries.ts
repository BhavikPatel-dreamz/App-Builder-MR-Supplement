/**
 * Storefront GraphQL queries + precomputed APQ hashes for GET /graphql?sha256=…
 *
 * Hash = SHA-256 hex of the exact query string (trimmed). Register once via POST
 * or GET ?query=… then clients use only sha256 + variables.
 */

export const PRODUCTS_BY_COLLECTION_ID_QUERY = `query ProductsByCollectionId($id: ID!, $first: Int!) {
  collection(id: $id) {
    title
    products(first: $first) {
      edges { node {
        id title handle availableForSale
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
      } }
    }
  }
}`;

export const PRODUCT_BY_HANDLE_QUERY = `query ProductByHandle($handle: String!) {
  product(handle: $handle) {
    id title handle description
    availableForSale
    featuredImage { url altText width height }
    priceRange { minVariantPrice { amount currencyCode } }
    variants(first: 50) {
      edges { node {
        id title availableForSale sku
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { url altText }
      } }
    }
    images(first: 20) {
      edges { node { url altText width height } }
    }
  }
}`;

/** Verified against demo + gateway (collection hot path). */
export const PRODUCTS_BY_COLLECTION_ID_SHA256 =
  "daea17f2dba59c50c3242ec2587cb33aaaa3b0ef1aa18075b4a9a1ee56b2f8c2";

export const PRODUCT_BY_HANDLE_SHA256 =
  "a9099543253991a8e6c4149bb9ff6e1bd5f6444401608cc6176e9bffb95425ca";

export const PERSISTED_QUERY_CATALOG = {
  productsByCollectionId: {
    name: "ProductsByCollectionId",
    query: PRODUCTS_BY_COLLECTION_ID_QUERY,
    sha256: PRODUCTS_BY_COLLECTION_ID_SHA256,
  },
  productByHandle: {
    name: "ProductByHandle",
    query: PRODUCT_BY_HANDLE_QUERY,
    sha256: PRODUCT_BY_HANDLE_SHA256,
  },
} as const;

export type PersistedQueryEntry = {
  name: string;
  query: string;
  sha256: string;
};

export function allPersistedQueries(): PersistedQueryEntry[] {
  return Object.values(PERSISTED_QUERY_CATALOG)
    .filter((e): e is PersistedQueryEntry => typeof e.sha256 === "string" && e.sha256.length > 0);
}
