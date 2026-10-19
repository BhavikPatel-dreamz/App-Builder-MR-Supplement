import { describe, expect, it } from "vitest";

import {
  mergeReviews,
  oldIdFromTags,
  oldProductUrl,
  toProductGid,
  variantLabel,
} from "../reviews-format";

describe("review formatting", () => {
  it("prefixes numeric product ids", () => {
    expect(toProductGid("42")).toBe("gid://shopify/Product/42");
    expect(toProductGid("gid://shopify/Product/42")).toBe("gid://shopify/Product/42");
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
});
