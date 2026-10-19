import { describe, expect, it } from "vitest";

import {
  averageStar,
  mergeReviews,
  paginateReviews,
  oldIdFromTags,
  oldProductUrl,
  reviewProductCacheId,
  toProductGid,
  trustpilotApiRoot,
  variantLabel,
} from "../reviews-format";

describe("review formatting", () => {
  it("prefixes numeric product ids", () => {
    expect(toProductGid("42")).toBe("gid://shopify/Product/42");
    expect(toProductGid("gid://shopify/Product/42")).toBe("gid://shopify/Product/42");
    expect(reviewProductCacheId("gid://shopify/Product/42")).toBe("42");
    expect(reviewProductCacheId("42")).toBe("42");
  });

  it("builds the legacy product url and reads old ids from tags", () => {
    expect(oldProductUrl("https://www.mrsupplement.com.au/", "whey")).toBe(
      "https://www.mrsupplement.com.au/whey",
    );
    expect(oldIdFromTags(["sale", "old_991_id"])).toBe("991");
  });

  it("joins variant options and falls back to the title", () => {
    expect(
      variantLabel({
        title: "Default",
        selectedOptions: [{ value: "Chocolate" }, { value: "1kg" }],
      }),
    ).toBe("Chocolate / 1kg");
    expect(variantLabel({ title: "Default Title", selectedOptions: [] })).toBe(
      "Default Title",
    );
  });

  it("drops stored trustpilot copies, maps live reviews, and sorts newest first", () => {
    const merged = mergeReviews(
      [
        {
          rSource: "trustpilot",
          rName: "Old copy",
          rCreated: "2020-01-01T00:00:00.000Z",
          rPoints: 1,
        },
        {
          rSource: "internal",
          rName: "Sam",
          rContent: "Good",
          rCreated: "2024-01-01T00:00:00.000Z",
          rPoints: 4,
          variant_name: "1kg",
        },
      ],
      [
        {
          id: "tp-1",
          createdAt: "2025-06-01T00:00:00.000Z",
          stars: 5,
          content: "Great",
          consumer: { displayName: "Alex" },
        },
      ],
    );
    expect(merged.reviews_counts).toBe(2);
    expect(merged.reviews[0]).toMatchObject({ rSource: "trustpilot", rName: "Alex", rPoints: 5 });
    expect(merged.reviews[1]).toMatchObject({ rSource: "internal", rName: "Sam" });
    expect(merged.average_star).toBe(4.5);
  });

  it("ignores a text rating when averaging, the way the old PHP sum did", () => {
    const merged = mergeReviews(
      [
        { rSource: "internal", rName: "A", rCreated: "2024-01-01", rPoints: "5.0000" },
        {
          rSource: "internal",
          rName: "B",
          rCreated: "2024-01-02",
          rPoints: "not a number",
        },
      ],
      [],
    );
    expect(merged.reviews_counts).toBe(2);
    expect(merged.average_star).toBe(2.5);
    expect(Number.isFinite(merged.average_star)).toBe(true);
    expect(
      averageStar([
        { rPoints: "5.0000" },
        { rPoints: " something which caused the intensity of my workout to falter" },
      ]),
    ).toBe(2.5);
  });

  it("does not append a second /v1 when the Trustpilot base already has one", () => {
    expect(trustpilotApiRoot("https://api.trustpilot.com/v1/")).toBe(
      "https://api.trustpilot.com",
    );
    expect(trustpilotApiRoot("")).toBe("https://api.trustpilot.com");
  });

  it("returns 20 reviews per page and keeps the total count", () => {
    const reviews = Array.from({ length: 45 }, (_, index) => index + 1);
    const first = paginateReviews(reviews, 1);
    const second = paginateReviews(reviews, 2);
    const last = paginateReviews(reviews, 3);
    const beyond = paginateReviews(reviews, 4);

    expect(first.per_page).toBe(20);
    expect(first.reviews).toEqual(reviews.slice(0, 20));
    expect(first.reviews_counts).toBe(45);
    expect(first.total_pages).toBe(3);
    expect(second.reviews).toEqual(reviews.slice(20, 40));
    expect(last.reviews).toHaveLength(5);
    expect(beyond.reviews).toEqual([]);
  });
});
