#!/usr/bin/env tsx
/**
 * Load test: concurrent same-key cache misses should coalesce Shopify fetches.
 *
 * Usage:
 *   pnpm load-test:coalescing
 *
 * Requires REDIS_URL + Shopify env vars. Runs against local or remote API.
 */

const API_URL = process.env.LOAD_TEST_URL || "http://localhost:3000/graphql";
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 50);
const QUERY = `query ProductsByCollectionId($id: ID!, $first: Int!) {
  collection(id: $id) {
    title
    products(first: $first) { edges { node { id title } } }
  }
}`;

async function main() {
  const variables = {
    id: "gid://shopify/Collection/568648040759",
    first: 5,
  };
  const body = JSON.stringify({ query: QUERY, variables, cache: "bypass" });

  console.log(`[load-test] ${CONCURRENCY} concurrent bypass requests → ${API_URL}`);

  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).then(async (r) => ({
        status: r.status,
        cache: r.headers.get("X-Cache"),
        ms: Number(r.headers.get("X-Proxy-Duration-Ms") || 0),
      })),
    ),
  );
  const elapsed = Date.now() - started;

  const ok = results.filter((r) => r.status === 200).length;
  console.log(
    JSON.stringify(
      {
        concurrency: CONCURRENCY,
        elapsedMs: elapsed,
        ok,
        cacheStatuses: results.reduce(
          (acc, r) => {
            acc[r.cache || "none"] = (acc[r.cache || "none"] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      null,
      2,
    ),
  );
  console.log(
    "[load-test] Check server logs for shopify_fetch count — expect ~1 per coalescing window, not",
    CONCURRENCY,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
