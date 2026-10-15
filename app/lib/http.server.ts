// ---------------------------------------------------------------------------
// Global HTTP dispatcher tuning (undici)
//
// Node's global `fetch` is backed by undici. Its default connection pool is
// modest; under the concurrency of a busy gateway (many simultaneous cache
// misses fanning out to Shopify) that causes connection churn. Setting a tuned
// global dispatcher keeps a warm keep-alive pool so repeat calls to Shopify
// reuse connections instead of re-handshaking TLS every time.
//
// Imported once as a side-effect from the Storefront executor. It is a no-op
// under Vitest (fetch is stubbed there) so it never interferes with tests.
// ---------------------------------------------------------------------------

if (!process.env.VITEST) {
  // Import lazily inside the guard so test runs never touch undici internals.
  import("undici")
    .then(({ Agent, setGlobalDispatcher }) => {
      setGlobalDispatcher(
        new Agent({
          keepAliveTimeout: 30_000, // reuse idle conns for 30s
          keepAliveMaxTimeout: 60_000,
          connections: 128, // pool size to a single origin (Shopify) under load
          pipelining: 1,
        }),
      );
      console.log("[http] undici global dispatcher tuned (keep-alive, 128 conns)");
    })
    .catch((err: unknown) => {
      console.error(
        "[http] failed to configure undici dispatcher (continuing with default):",
        err instanceof Error ? err.message : err,
      );
    });
}

export {};
