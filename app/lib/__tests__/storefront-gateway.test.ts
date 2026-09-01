import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

import {
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_BY_HANDLE_SHA256,
  PRODUCTS_BY_COLLECTION_ID_QUERY,
  PRODUCTS_BY_COLLECTION_ID_SHA256,
  allPersistedQueries,
} from "../persisted-queries";
import {
  buildPersistedQueryUrl,
  DEFAULT_GATEWAY_URL,
} from "../storefront-gateway";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s.trim()).digest("hex");
}

describe("persisted-queries", () => {
  it("collection query hash matches gateway APQ", () => {
    expect(sha256Hex(PRODUCTS_BY_COLLECTION_ID_QUERY)).toBe(PRODUCTS_BY_COLLECTION_ID_SHA256);
  });

  it("product by handle hash is stable", () => {
    expect(sha256Hex(PRODUCT_BY_HANDLE_QUERY)).toBe(PRODUCT_BY_HANDLE_SHA256);
  });

  it("catalog lists all queries with hashes", () => {
    expect(allPersistedQueries().length).toBe(2);
  });
});

describe("storefront-gateway", () => {
  it("builds cacheable GET url", () => {
    const url = buildPersistedQueryUrl(PRODUCTS_BY_COLLECTION_ID_SHA256, {
      id: "gid://shopify/Collection/1",
      first: 250,
    });
    expect(url.startsWith(DEFAULT_GATEWAY_URL)).toBe(true);
    expect(url).toContain("sha256=daea17f2");
    expect(url).toContain("variables=");
  });
});
