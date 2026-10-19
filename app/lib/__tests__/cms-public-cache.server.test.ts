import { describe, it, expect } from "vitest";

import {
  CMS_PAGES_CACHE_PREFIX,
  cmsPageSlugCacheKey,
  cmsPagesCachePrefix,
  cmsPagesListCacheKey,
  cmsSettingsCacheKey,
  normalizeShopDomain,
  reviewsGetCacheKey,
} from "../cms-public-cache.server";

describe("normalizeShopDomain", () => {
  it("strips protocol and trailing slash, lowercases", () => {
    expect(normalizeShopDomain("https://XYXX.myshopify.com/")).toBe(
      "xyxx.myshopify.com",
    );
  });

  it("leaves a bare myshopify domain unchanged besides case", () => {
    expect(normalizeShopDomain("Shop.Myshopify.Com")).toBe("shop.myshopify.com");
  });
});

describe("CMS public cache keys", () => {
  it("prefixes with cms:pages:", () => {
    expect(cmsPagesCachePrefix("xyxx.myshopify.com")).toBe(
      `${CMS_PAGES_CACHE_PREFIX}xyxx.myshopify.com:`,
    );
  });

  it("builds a stable list key", () => {
    expect(cmsPagesListCacheKey("https://xyxx.myshopify.com")).toBe(
      "cms:pages:xyxx.myshopify.com:list",
    );
  });

  it("builds a slug key (normalized)", () => {
    expect(cmsPageSlugCacheKey("XYXX.myshopify.com", " Home ")).toBe(
      "cms:pages:xyxx.myshopify.com:slug:home",
    );
  });

  it("builds a settings key", () => {
    expect(cmsSettingsCacheKey("https://XYXX.myshopify.com")).toBe(
      "cms:settings:v5:xyxx.myshopify.com",
    );
  });

  it("builds one reviews key for a numeric id and its gid", () => {
    expect(reviewsGetCacheKey("XYXX.myshopify.com", "42")).toBe(
      "reviews:get:v1:xyxx.myshopify.com:42",
    );
    expect(reviewsGetCacheKey("xyxx.myshopify.com", "gid://shopify/Product/42")).toBe(
      reviewsGetCacheKey("xyxx.myshopify.com", "42"),
    );
  });

  it("uses different keys for list vs slug", () => {
    const shop = "xyxx.myshopify.com";
    expect(cmsPagesListCacheKey(shop)).not.toBe(
      cmsPageSlugCacheKey(shop, "home"),
    );
  });
});
