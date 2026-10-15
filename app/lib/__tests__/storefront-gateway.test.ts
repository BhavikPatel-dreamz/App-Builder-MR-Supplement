import { describe, expect, it } from "vitest";

import {
  PRODUCT_BY_HANDLE_SHA256,
  PRODUCTS_BY_COLLECTION_ID_QUERY,
  PRODUCTS_BY_COLLECTION_ID_SHA256,
  allPersistedQueries,
  fallbackCatalogQuery,
  lookupCatalogOp,
} from "../persisted-queries";
import { STOREFRONT_PQ } from "../storefront-query-hashes";
import {
  buildPersistedQueryUrl,
  DEFAULT_GATEWAY_URL,
} from "../storefront-gateway";

describe("persisted-queries", () => {
  it("catalog hashes match STOREFRONT_PQ (native GET sha256)", () => {
    expect(PRODUCTS_BY_COLLECTION_ID_SHA256).toBe(STOREFRONT_PQ.productsByCollectionId);
    expect(PRODUCT_BY_HANDLE_SHA256).toBe(STOREFRONT_PQ.productByHandle);
  });

  it("catalog lists all native queries", () => {
    expect(allPersistedQueries().length).toBe(5);
  });

  it("maps collection variables to the collection-id catalog query", () => {
    expect(
      fallbackCatalogQuery({
        id: "gid://shopify/Collection/1",
        first: 10,
      })?.query,
    ).toBe(PRODUCTS_BY_COLLECTION_ID_QUERY);
  });

  it("resolves named ops without a client hash", () => {
    expect(lookupCatalogOp("productsByCollectionId")?.sha256).toBe(PRODUCTS_BY_COLLECTION_ID_SHA256);
    expect(lookupCatalogOp("collection")?.sha256).toBe(PRODUCTS_BY_COLLECTION_ID_SHA256);
  });
});

describe("storefront-gateway", () => {
  it("builds cacheable GET url", () => {
    const url = buildPersistedQueryUrl(PRODUCTS_BY_COLLECTION_ID_SHA256, {
      id: "gid://shopify/Collection/1",
      first: 250,
    });
    expect(url.startsWith(DEFAULT_GATEWAY_URL)).toBe(true);
    expect(url).toContain("sha256=7ef76e63");
    expect(url).toContain("variables=");
  });
});
