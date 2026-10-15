/**
 * Purge + re-warm the Mumbai VPS catalog-cache (cache.dreamzapps.com).
 * No-op unless CACHE_INDIA_PURGE_HOST or CACHE_INDIA_WARM_HOST is set.
 */

function indiaHost(): string {
  return (
    process.env.CACHE_INDIA_PURGE_HOST ||
    process.env.CACHE_INDIA_WARM_HOST ||
    ""
  ).replace(/\/$/, "");
}

export async function purgeIndiaEdge(urls: string[]): Promise<string> {
  const host = indiaHost();
  const secret = process.env.CACHE_CRON_SECRET || "";
  if (!host || !secret || urls.length === 0) {
    return `skipped (host=${host ? "set" : "MISSING"}, secret=${secret ? "set" : "MISSING"}, urls=${urls.length})`;
  }
  try {
    const res = await fetch(`${host}/purge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cron-secret": secret,
      },
      body: JSON.stringify({ urls }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error("[india-edge] purge failed:", res.status);
      return `http_${res.status}`;
    }
    const body = (await res.json().catch(() => ({}))) as {
      purged?: number;
      misses?: number;
    };
    return `ok purged=${body.purged ?? "?"} misses=${body.misses ?? "?"}`;
  } catch (err) {
    console.error(
      "[india-edge] purge error:",
      err instanceof Error ? err.message : err,
    );
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function warmIndiaEdge(urls: string[]): Promise<string> {
  const host =
    (process.env.CACHE_INDIA_WARM_HOST || process.env.CACHE_INDIA_PURGE_HOST || "").replace(
      /\/$/,
      "",
    );
  if (!host || urls.length === 0) return "skipped";
  let ok = 0;
  for (const raw of urls) {
    let path = raw;
    try {
      if (/^https?:\/\//i.test(raw)) {
        const parsed = new URL(raw);
        path = parsed.pathname + parsed.search;
      }
    } catch {
      continue;
    }
    try {
      const res = await fetch(`${host}${path}`, {
        method: "GET",
        headers: { Accept: "application/json", "X-Cache-Warm": "1" },
        signal: AbortSignal.timeout(8_000),
      });
      await res.arrayBuffer();
      if (res.ok) ok += 1;
    } catch {
      /* best-effort */
    }
  }
  return `warmed ${ok}/${urls.length}`;
}

export async function purgeAndWarmIndiaEdge(urls: string[]): Promise<{
  purge: string;
  warm: string;
}> {
  const purge = await purgeIndiaEdge(urls);
  const warm = await warmIndiaEdge(urls);
  return { purge, warm };
}
