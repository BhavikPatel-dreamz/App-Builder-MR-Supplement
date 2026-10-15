import { describe, expect, it } from "vitest";

import { isCacheCronAuthorized } from "../cache-cron-auth.server";

describe("isCacheCronAuthorized", () => {
  it("allows Vercel Cron header", () => {
    const request = new Request("https://example.com/api/cron/cache-refresh", {
      headers: { "x-vercel-cron": "1" },
    });
    expect(isCacheCronAuthorized(request)).toBe(true);
  });

  it("allows vercel-cron user agent", () => {
    const request = new Request("https://example.com/api/cron/cache-refresh", {
      headers: { "user-agent": "vercel-cron/1.0" },
    });
    expect(isCacheCronAuthorized(request)).toBe(true);
  });

  it("rejects anonymous GET", () => {
    const request = new Request("https://example.com/api/cron/cache-refresh");
    expect(isCacheCronAuthorized(request)).toBe(false);
  });
});
