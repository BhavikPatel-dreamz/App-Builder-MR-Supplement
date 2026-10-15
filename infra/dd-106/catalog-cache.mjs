#!/usr/bin/env node
/**
 * India catalog cache on dd-106. No aaPanel nginx required.
 * GET /graphql and /cms/* → origin, 30 min memory cache, X-India-Cache.
 *
 * Upgraded:
 *  - LRU bound (CATALOG_CACHE_MAX_ENTRIES, default 50k) so 100k-product
 *    catalogs cannot OOM the box.
 *  - SWR envelopes ({ v, exp, staleUntil }) mirroring the origin's
 *    redis-cache.server.ts semantics: fresh → HIT, stale → serve instantly
 *    and refresh in the background (single-flight), dead → MISS.
 *  - Per-URL purge: POST /purge?url=<path|full-url> or JSON {"urls":[...]}.
 *  - Disk snapshot persistence (CATALOG_CACHE_SNAPSHOT_FILE, every
 *    CATALOG_CACHE_SNAPSHOT_MS when dirty + on SIGTERM) so a restart of the
 *    VPS process does not go fully cold.
 */
import http from "node:http";
import fs from "node:fs";
import { Agent, fetch } from "undici";

const ORIGIN = (process.env.CATALOG_ORIGIN || "https://appbuilder.dreamzapps.com").replace(
  /\/$/,
  "",
);
const PORT = Number(process.env.CATALOG_CACHE_PORT || 8088);
const TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS || 30 * 60 * 1000);
// Stale window defaults to the TTL (total lifetime 2×TTL), same as origin.
const SWR_MS = Number(process.env.CATALOG_CACHE_SWR_MS || TTL_MS);
const MAX_ENTRIES = Number(process.env.CATALOG_CACHE_MAX_ENTRIES || 50_000);
const SNAPSHOT_FILE =
  process.env.CATALOG_CACHE_SNAPSHOT_FILE || new URL("./catalog-cache-snapshot.json", import.meta.url).pathname;
const SNAPSHOT_MS = Number(process.env.CATALOG_CACHE_SNAPSHOT_MS || 60_000);
const SKIP = /^\/(app|admin|auth|webhooks|api\/cron|api\/auth)(\/|$)/;

const agent = new Agent({ keepAliveTimeout: 60_000, connections: 32 });

// ---------------------------------------------------------------------------
// Cache store: key -> { v: { status, headers, bodyB64 }, exp, staleUntil }
// Map preserves insertion order → cheap LRU (delete + set bumps recency).
// ---------------------------------------------------------------------------
const mem = new Map();
let dirty = false;

function memGet(key) {
  const entry = mem.get(key);
  if (!entry) return null;
  if (entry.staleUntil <= Date.now()) {
    mem.delete(key);
    dirty = true;
    return null;
  }
  mem.delete(key);
  mem.set(key, entry);
  return entry;
}

function memSet(key, entry) {
  if (mem.size >= MAX_ENTRIES && !mem.has(key)) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.delete(key);
  mem.set(key, hydrateEntry(entry));
  dirty = true;
}

function memDel(key) {
  if (mem.delete(key)) dirty = true;
}

function hydrateEntry(entry) {
  const v = entry.v || {};
  const bodyBuf = v.bodyBuf
    ? Buffer.isBuffer(v.bodyBuf)
      ? v.bodyBuf
      : Buffer.from(v.bodyBuf)
    : Buffer.from(v.bodyB64 || "", "base64");
  return {
    exp: entry.exp,
    staleUntil: entry.staleUntil,
    v: { status: v.status, headers: v.headers || {}, bodyBuf },
  };
}

// ---------------------------------------------------------------------------
// Disk snapshot persistence
// ---------------------------------------------------------------------------
function saveSnapshot() {
  if (!dirty) return;
  const now = Date.now();
  const out = [];
  for (const [key, entry] of mem) {
    if (entry.staleUntil <= now) continue;
    const v = entry.v || {};
    const bodyB64 =
      v.bodyB64 ||
      (v.bodyBuf ? Buffer.from(v.bodyBuf).toString("base64") : "");
    out.push([
      key,
      {
        exp: entry.exp,
        staleUntil: entry.staleUntil,
        v: { status: v.status, headers: v.headers, bodyB64 },
      },
    ]);
  }
  const tmp = `${SNAPSHOT_FILE}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, SNAPSHOT_FILE);
    dirty = false;
  } catch (err) {
    console.error("[catalog-cache] snapshot save failed:", err instanceof Error ? err.message : err);
  }
}

function loadSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return;
    const rows = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
    const now = Date.now();
    let loaded = 0;
    for (const [key, entry] of rows) {
      if (!entry || entry.staleUntil <= now) continue;
      mem.set(key, hydrateEntry(entry));
      loaded += 1;
    }
    console.log(JSON.stringify({ event: "snapshot-load", loaded, file: SNAPSHOT_FILE }));
  } catch (err) {
    console.error("[catalog-cache] snapshot load failed:", err instanceof Error ? err.message : err);
  }
}

setInterval(saveSnapshot, SNAPSHOT_MS).unref();
process.on("SIGTERM", () => {
  saveSnapshot();
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Proxy helpers
// ---------------------------------------------------------------------------
function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept, X-Cache-Warm, X-Cron-Secret",
    "access-control-expose-headers":
      "X-Cache, X-India-Cache, X-India-Pop, X-Proxy-Duration-Ms, Server-Timing, CF-Cache-Status",
    "access-control-max-age": "86400",
  };
}

/** Origin warmer sends X-Cache-Warm: 1. Treat as a forced refill: fetch origin
 * and replace the stored entry instead of serving a HIT/STALE. */
function forceRefresh(req) {
  return String(req.headers["x-cache-warm"] || "") === "1";
}

const DROP_RES = new Set([
  "transfer-encoding",
  "connection",
  "keep-alive",
  "content-encoding",
  "content-length",
  "alt-svc",
  // Origin cache-status headers would go stale inside a stored entry (a HIT
  // replaying "x-cache: MISS" from fill time is confusing). The edge's own
  // x-india-cache header is the source of truth on this layer.
  "x-cache",
  "x-proxy-duration-ms",
  "server-timing",
  // Origin is behind Cloudflare/Vercel — their edge headers describe the
  // Mumbai→origin fetch at fill time, not this response.
  "cf-cache-status",
  "cf-ray",
  "age",
  "x-vercel-cache",
  "x-vercel-id",
  "nel",
  "report-to",
  "server",
]);

function skipCache(method, path) {
  if (method !== "GET" && method !== "HEAD") return true;
  return SKIP.test(path.split("?")[0]);
}

function dropNullVars(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const val = value[key];
    if (val === null || val === undefined) continue;
    const nested =
      val && typeof val === "object" && !Array.isArray(val) ? dropNullVars(val) : val;
    if (nested && typeof nested === "object" && !Array.isArray(nested) && !Object.keys(nested).length) {
      continue;
    }
    out[key] = nested;
  }
  return out;
}

/** Same key as origin warm: drop after:null, sort keys, lowercase sha256. */
function cacheKeyFor(req) {
  const raw = req.url || "/";
  try {
    const u = new URL(raw, "http://local");
    const OPS = {
      productsbycollectionid: "7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871",
      collection: "7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871",
      collectionid: "7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871",
      productsbycollection: "5857d1f281469b9b3923f81d15e41d5a72790d847e074d9e0f0d6d690f76a279",
      productsbycollectionhandle: "5857d1f281469b9b3923f81d15e41d5a72790d847e074d9e0f0d6d690f76a279",
      collectionhandle: "5857d1f281469b9b3923f81d15e41d5a72790d847e074d9e0f0d6d690f76a279",
      getproductbyproductid: "2c8cbf5948d3e5560c38b9b866bd79b56eaf795e7e56a6f302ff58301ac5cc93",
      productbyid: "2c8cbf5948d3e5560c38b9b866bd79b56eaf795e7e56a6f302ff58301ac5cc93",
      product: "2c8cbf5948d3e5560c38b9b866bd79b56eaf795e7e56a6f302ff58301ac5cc93",
      getproductbyhandle: "05f53f406858a1e025dac342c9769d20da451daf4071b4ee3117164e5c356215",
      productbyhandle: "05f53f406858a1e025dac342c9769d20da451daf4071b4ee3117164e5c356215",
      getproductsbyids: "3dee64be90e676c413abe7f1660366826e8296c1866f584aade05fbd8fee5ab3",
      productsbyids: "3dee64be90e676c413abe7f1660366826e8296c1866f584aade05fbd8fee5ab3",
      ids: "3dee64be90e676c413abe7f1660366826e8296c1866f584aade05fbd8fee5ab3",
    };
    let sha = (u.searchParams.get("sha256") || "").trim().toLowerCase();
    const op = (u.searchParams.get("op") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!sha && op && OPS[op]) sha = OPS[op];
    if (!sha || u.searchParams.has("query")) return `${req.method} ${raw}`;
    const parsed = JSON.parse(u.searchParams.get("variables") || "{}");
    const vars = JSON.stringify(dropNullVars(parsed));
    return `${req.method} /graphql?sha256=${sha}&variables=${encodeURIComponent(vars)}`;
  } catch {
    return `${req.method} ${raw}`;
  }
}

function copyReqHeaders(req) {
  const originHost = new URL(ORIGIN).host;
  const headers = {
    host: originHost,
    accept: req.headers.accept || "application/json",
    "accept-encoding": "identity",
  };
  if (req.headers["x-cache-warm"]) headers["x-cache-warm"] = req.headers["x-cache-warm"];
  return headers;
}

async function proxy(req) {
  const keyPath = cacheKeyFor(req).slice(String(req.method).length + 1);
  const u = new URL(ORIGIN + keyPath);
  // Only webhook/cron refill should skip Cloudflare. A normal MISS should
  // reuse origin/CF so collection PLP is hundreds of ms, not a Shopify round-trip.
  if (forceRefresh(req) && !u.searchParams.has("cache")) u.searchParams.set("cache", "refresh");
  const res = await fetch(u.toString(), {
    method: req.method,
    headers: copyReqHeaders(req),
    dispatcher: agent,
    redirect: "manual",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = {};
  res.headers.forEach((value, key) => {
    if (DROP_RES.has(key.toLowerCase())) return;
    headers[key] = value;
  });
  headers["content-length"] = String(buf.length);
  if (!headers["content-type"]) headers["content-type"] = "application/json";
  return { status: res.status, headers, body: buf };
}

// Single-flight: one background refresh per key at a time.
const inFlight = new Map();

function refreshInBackground(req, key) {
  if (inFlight.has(key)) return;
  const p = (async () => {
    try {
      const out = await proxy(req);
      if (out.status === 200) {
        const now = Date.now();
        memSet(key, {
          v: { status: out.status, headers: out.headers, bodyBuf: out.body },
          exp: now + TTL_MS,
          staleUntil: now + TTL_MS + SWR_MS,
        });
      }
    } catch (err) {
      console.error("[catalog-cache] bg refresh failed:", err instanceof Error ? err.message : err);
    }
  })();
  inFlight.set(key, p);
  p.finally(() => inFlight.delete(key));
}

function authorized(req) {
  const expected = process.env.CACHE_CRON_SECRET || "";
  const got = String(req.headers["x-cron-secret"] || "");
  return Boolean(expected) && got === expected;
}

/** Normalize a purge target: full URL or path → pathname + search. */
function purgePath(target) {
  let path = target;
  try {
    if (/^https?:\/\//i.test(target)) path = new URL(target).pathname + new URL(target).search;
  } catch {
    return null;
  }
  if (!path.startsWith("/")) return null;
  return path;
}

/** Delete GET/HEAD entries for a URL, including encoding/Caddy variants. */
function purgeFuzzy(target) {
  const path = purgePath(target);
  if (!path) return 0;
  let n = 0;
  let sha = "";
  let needle = "";
  try {
    const u = new URL(path, "http://local");
    sha = (u.searchParams.get("sha256") || "").toLowerCase();
    const raw = u.searchParams.get("variables") || "";
    const v = JSON.parse(raw);
    needle = String(v.id || v.handle || "");
  } catch {
    /* exact path match still applies */
  }
  for (const key of [...mem.keys()]) {
    const exact = key === `GET ${path}` || key === `HEAD ${path}`;
    const sameHash = sha && key.toLowerCase().includes(sha);
    const sameRes =
      !needle ||
      key.includes(encodeURIComponent(needle)) ||
      key.includes(needle) ||
      (() => {
        try {
          return decodeURIComponent(key).includes(needle);
        } catch {
          return false;
        }
      })();
    const pathname = path.split("?")[0];
    const cmsPrefix =
      pathname === "/cms/pages" ||
      pathname === "/cms/settings" ||
      pathname.startsWith("/cms/pages/") ||
      pathname.startsWith("/cms/settings/");
    if (exact || (sameHash && sameRes) || (cmsPrefix && key.includes(` ${pathname}`))) {
      memDel(key);
      n += 1;
    }
  }
  return n;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendEntry(req, res, entry, cacheStatus) {
  const body = entry.v.bodyBuf || Buffer.from(entry.v.bodyB64 || "", "base64");
  res.writeHead(entry.v.status, {
    ...entry.v.headers,
    ...corsHeaders(),
    connection: "keep-alive",
    "keep-alive": "timeout=75",
    "x-india-cache": cacheStatus,
    "x-india-pop": "dd-106",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const pathname = (req.url || "/").split("?")[0];
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain", "x-india-pop": "dd-106" });
    res.end("ok\n");
    return;
  }

  if (pathname === "/flush" && (req.method === "POST" || req.method === "GET")) {
    if (!authorized(req)) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("unauthorized\n");
      return;
    }
    const cleared = mem.size;
    mem.clear();
    dirty = true;
    saveSnapshot();
    res.writeHead(200, { "content-type": "application/json", "x-india-cache": "FLUSH" });
    res.end(JSON.stringify({ ok: true, cleared }));
    return;
  }

  // Per-URL purge: POST /purge?url=<path|full-url> or JSON body {"urls":[...]}
  if (pathname === "/purge" && (req.method === "POST" || req.method === "GET")) {
    if (!authorized(req)) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("unauthorized\n");
      return;
    }
    const targets = [];
    const qs = new URL(req.url, "http://localhost").searchParams.get("url");
    if (qs) targets.push(qs);
    if (req.method === "POST") {
      try {
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        if (Array.isArray(body.urls)) targets.push(...body.urls.map(String));
      } catch {
        /* query-string purge still applies */
      }
    }
    let purged = 0;
    const misses = [];
    for (const target of targets) {
      const before = mem.size;
      purged += purgeFuzzy(target);
      if (mem.size === before) misses.push(target);
    }
    res.writeHead(200, { "content-type": "application/json", "x-india-cache": "PURGE" });
    res.end(JSON.stringify({ ok: true, purged, requested: targets.length, misses: misses.length }));
    return;
  }

  const path = req.url || "/";
  const origKey = `${req.method} ${path}`;
  const key = cacheKeyFor(req);
  const bypass = skipCache(req.method, path);
  const refresh = forceRefresh(req);
  const now = Date.now();

  if (!bypass && !refresh) {
    const hit = memGet(key) || (origKey !== key ? memGet(origKey) : null);
    if (hit) {
      if (hit.exp > now) {
        sendEntry(req, res, hit, "HIT");
      } else {
        // Stale: serve instantly, refresh in the background (single-flight).
        sendEntry(req, res, hit, "STALE");
        refreshInBackground(req, key);
      }
      return;
    }
  }

  try {
    const out = await proxy(req);
    if (!bypass && out.status === 200) {
      memSet(key, {
        v: { status: out.status, headers: out.headers, bodyBuf: out.body },
        exp: now + TTL_MS,
        staleUntil: now + TTL_MS + SWR_MS,
      });
    }
    res.writeHead(out.status, {
      ...out.headers,
      ...corsHeaders(),
      "x-india-cache": bypass ? "BYPASS" : refresh ? "REFRESH" : "MISS",
      "x-india-pop": "dd-106",
    });
    res.end(req.method === "HEAD" ? undefined : out.body);
  } catch (err) {
    res.writeHead(502, {
      "content-type": "application/json",
      ...corsHeaders(),
      "x-india-cache": "ERROR",
    });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "proxy failed" }));
  }
});

loadSnapshot();
server.keepAliveTimeout = 75_000;
server.headersTimeout = 80_000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      event: "catalog-cache-listen",
      port: PORT,
      origin: ORIGIN,
      ttlMs: TTL_MS,
      swrMs: SWR_MS,
      maxEntries: MAX_ENTRIES,
      snapshotFile: SNAPSHOT_FILE,
    }),
  );
});
