import {
  PRODUCT_BY_HANDLE_SHA256,
  PRODUCT_BY_ID_SHA256,
  PRODUCTS_BY_COLLECTION_HANDLE_SHA256,
  PRODUCTS_BY_COLLECTION_ID_SHA256,
  PRODUCTS_BY_IDS_SHA256,
} from "./persisted-queries";

/** Native app persisted-query hashes (sha256 of the GraphQL document). */
export const STOREFRONT_PQ = {
  productsByCollectionId: PRODUCTS_BY_COLLECTION_ID_SHA256,
  productsByCollectionHandle: PRODUCTS_BY_COLLECTION_HANDLE_SHA256,
  productById: PRODUCT_BY_ID_SHA256,
  productByHandle: PRODUCT_BY_HANDLE_SHA256,
  productsByIds: PRODUCTS_BY_IDS_SHA256,
} as const;

export const ALL_STOREFRONT_PQ_HASHES = Object.values(STOREFRONT_PQ);

/** Default collection PLP variables used by the native GET curl (after:null dropped). */
export function collectionByIdVariables(id: string, first: number) {
  return {
    id,
    first,
    sortKey: "COLLECTION_DEFAULT",
    reverse: false,
    filters: [] as unknown[],
  };
}

export function collectionByHandleVariables(handle: string, first: number) {
  return {
    handle,
    first,
    sortKey: "COLLECTION_DEFAULT",
    reverse: false,
    filters: [] as unknown[],
  };
}
