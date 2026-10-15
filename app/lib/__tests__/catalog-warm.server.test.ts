import { describe, expect, it } from "vitest";

import { catalogGraphqlPaths, catalogWarmLimits, classifyWarmSchedule } from "../catalog-warm.server";
import { STOREFRONT_PQ } from "../storefront-query-hashes";

describe("catalogGraphqlPaths", () => {
  it("emits collection-by-id and product-by-id GET URLs", () => {
    const paths = catalogGraphqlPaths({
      collections: [{ id: "gid://shopify/Collection/1", handle: "scivation" }],
      products: [{ id: "gid://shopify/Product/2", handle: "creapure" }],
    });
    expect(paths.some((path) => path.includes(STOREFRONT_PQ.productsByCollectionId))).toBe(true);
    expect(paths.some((path) => path.includes(STOREFRONT_PQ.productsByCollectionHandle))).toBe(
      true,
    );
    expect(paths.some((path) => path.includes(STOREFRONT_PQ.productById))).toBe(true);
    expect(paths.some((path) => path.includes(STOREFRONT_PQ.productByHandle))).toBe(true);
  });
});

describe("catalogWarmLimits", () => {
  it("defaults to 10k products and a large first-fill batch", () => {
    expect(catalogWarmLimits().maxProducts).toBe(10_000);
    expect(catalogWarmLimits().maxCollections).toBe(500);
    expect(catalogWarmLimits().batch).toBeGreaterThanOrEqual(400);
  });
});

describe("classifyWarmSchedule", () => {
  it("marks never-warmed URLs due with refresh so the first user is a HIT", () => {
    const decision = classifyWarmSchedule(0, 0);
    expect(decision.due).toBe(true);
    expect(decision.mode).toBe("refresh");
    expect(decision.ttl).toBe(1800);
  });
});
