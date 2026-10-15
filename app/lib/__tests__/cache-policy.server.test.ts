import { describe, expect, it } from "vitest";

import {
  DEFAULT_CACHE_TTL_SECONDS,
  parseCacheSettings,
  publicCacheControlValue,
  applyRuntimeCachePolicy,
  applyCdnCacheHeaders,
  CATALOG_CDN_CACHE_TAG,
} from "../cache-policy.server";

describe("parseCacheSettings", () => {
  it("defaults to 30 minute TTL and CDN+Redis on", () => {
    const parsed = parseCacheSettings({});
    expect(parsed.ttlSeconds).toBe(DEFAULT_CACHE_TTL_SECONDS);
    expect(parsed.ttlSeconds).toBe(1800);
    expect(parsed.redisEnabled).toBe(true);
    expect(parsed.cdnEnabled).toBe(true);
    expect(parsed.warmerEnabled).toBe(true);
  });

  it("clamps TTL into the 10–30 minute window", () => {
    expect(parseCacheSettings({ ttlSeconds: 5 }).ttlSeconds).toBe(1800);
    expect(parseCacheSettings({ ttlSeconds: 900 }).ttlSeconds).toBe(900);
    expect(parseCacheSettings({ ttlSeconds: 600 }).ttlSeconds).toBe(600);
    expect(parseCacheSettings({ ttlSeconds: 3600 }).ttlSeconds).toBe(1800);
  });
});

describe("publicCacheControlValue", () => {
  it("emits s-maxage for CDN", () => {
    applyRuntimeCachePolicy(parseCacheSettings({ ttlSeconds: 600, swrSeconds: 600 }));
    expect(publicCacheControlValue()).toContain("s-maxage=600");
    expect(publicCacheControlValue()).toContain("stale-while-revalidate=600");
    expect(publicCacheControlValue()).toContain("max-age=600");
  });

  it("uses no-store when CDN is off", () => {
    applyRuntimeCachePolicy(parseCacheSettings({ cdnEnabled: false }));
    expect(publicCacheControlValue()).toBe("no-store");
  });
});

describe("applyCdnCacheHeaders", () => {
  it("sets Cache-Tag for Cloudflare purge-by-tag", () => {
    applyRuntimeCachePolicy(parseCacheSettings({ ttlSeconds: 600, swrSeconds: 600 }));
    const headers: Record<string, string> = {};
    applyCdnCacheHeaders(headers);
    expect(headers["Cache-Tag"]).toBe(CATALOG_CDN_CACHE_TAG);
    expect(headers["Cloudflare-CDN-Cache-Control"]).toContain("max-age=600");
  });
});
