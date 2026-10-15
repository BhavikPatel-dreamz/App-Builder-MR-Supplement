import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import {
  clearAllPublicCache,
  clearOneCacheUrl,
  clearPublicCacheForKey,
  createCacheUrl,
  deleteCacheUrl,
  getOrCreateCacheConfig,
  listCacheLogs,
  mergeUrlCounts,
  updateCacheConfig,
  warmAllEnabledUrls,
  warmOneCacheUrl,
} from "../lib/cache-store.server";
import { AppTabBar, useAppTab } from "../components/AppTabBar";

function parseBool(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/** Resolve "gid://…", numeric id, or handle → { id, handle } via Admin API. */
async function resolveCatalogResource(
  admin: AdminClient,
  kind: "product" | "collection",
  input: string,
): Promise<{ id: string; handle: string } | null> {
  const value = input.trim();
  if (!value) return null;
  const resource = kind === "product" ? "Product" : "Collection";
  try {
    if (value.startsWith("gid://") || /^\d+$/.test(value)) {
      const id = value.startsWith("gid://")
        ? value
        : `gid://shopify/${resource}/${value}`;
      const res = await admin.graphql(
        `query Resolve${resource}($id: ID!) { ${kind}(id: $id) { id handle } }`,
        { variables: { id } },
      );
      const json = (await res.json()) as {
        data?: Record<string, { id: string; handle: string } | null>;
      };
      return json.data?.[kind] ?? null;
    }
    const res = await admin.graphql(
      `query Resolve${resource}ByHandle($handle: String!) { ${kind}ByHandle(handle: $handle) { id handle } }`,
      { variables: { handle: value } },
    );
    const json = (await res.json()) as {
      data?: Record<string, { id: string; handle: string } | null>;
    };
    return json.data?.[`${kind}ByHandle`] ?? null;
  } catch {
    return null;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await getOrCreateCacheConfig(session.shop);
  const urls = await mergeUrlCounts(config.urls);
  const logs = await listCacheLogs(session.shop, 50);
  return { config, urls, logs };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  try {
    if (intent === "save_config") {
      await updateCacheConfig(session.shop, {
        redisEnabled: parseBool(form.get("redisEnabled")),
        cdnEnabled: parseBool(form.get("cdnEnabled")),
        warmerEnabled: parseBool(form.get("warmerEnabled")),
        ttlSeconds: Number(form.get("ttlSeconds") || 1800),
        swrSeconds: Number(form.get("swrSeconds") || 1800),
        refreshIntervalSeconds: Number(form.get("refreshIntervalSeconds") || 300),
      });
      return { ok: true, message: "Cache settings saved." };
    }
    if (intent === "create_url") {
      await createCacheUrl(
        session.shop,
        String(form.get("label") || ""),
        String(form.get("url") || ""),
        String(form.get("queryText") || ""),
      );
      return { ok: true, message: "URL added." };
    }
    if (intent === "delete_url") {
      await deleteCacheUrl(session.shop, String(form.get("id") || ""));
      return { ok: true, message: "URL removed." };
    }
    if (intent === "clear_url") {
      const result = await clearOneCacheUrl(session.shop, String(form.get("id") || ""));
      return { ok: true, message: `Cleared ${result.label} (${result.durationMs}ms).` };
    }
    if (intent === "warm_url") {
      const result = await warmOneCacheUrl(session.shop, String(form.get("id") || ""));
      return { ok: true, message: `Warmed ${result.label} (${result.durationMs}ms).` };
    }
    if (intent === "warm_all") {
      const result = await warmAllEnabledUrls(session.shop);
      return { ok: true, message: `Warmed ${result.warmed} URL(s).` };
    }
    if (intent === "clear_all") {
      const result = await clearAllPublicCache(session.shop);
      return {
        ok: true,
        message: `Cleared GraphQL Redis (${result.graphqlKeys} keys), CMS, CDN purge. India: ${result.india}. ${result.durationMs}ms.`,
      };
    }
    if (intent === "clear_product" || intent === "clear_collection") {
      const kind = intent === "clear_product" ? ("product" as const) : ("collection" as const);
      const input = String(form.get("target") || "").trim();
      const rewarm = parseBool(form.get("rewarm"));
      const resolved = await resolveCatalogResource(admin, kind, input);
      if (!resolved) {
        return Response.json(
          { error: `Could not find ${kind} "${input}". Use a GID, numeric ID, or handle.` },
          { status: 404 },
        );
      }
      const result = await clearPublicCacheForKey(
        session.shop,
        { kind, id: resolved.id, handle: resolved.handle },
        { rewarm },
      );
      return { ok: true, message: result.message };
    }
    if (intent === "clear_scoped_url") {
      const url = String(form.get("url") || "").trim();
      if (!url) {
        return Response.json({ error: "URL is required." }, { status: 400 });
      }
      const rewarm = parseBool(form.get("rewarm"));
      const result = await clearPublicCacheForKey(
        session.shop,
        { kind: "url", url },
        { rewarm },
      );
      return { ok: true, message: result.message };
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cache action failed.";
    return Response.json({ error: message }, { status: 400 });
  }
};

function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function CachePage() {
  const { config, urls, logs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [tab, setTab] = useAppTab("clear");
  const busy = fetcher.state !== "idle";
  const message =
    fetcher.data && "message" in fetcher.data ? String(fetcher.data.message) : "";
  const error =
    fetcher.data && "error" in fetcher.data ? String(fetcher.data.error) : "";

  return (
    <s-page heading="Cache">
      {tab === "settings" ? (
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          const form = document.getElementById("cache-config-form") as HTMLFormElement | null;
          form?.requestSubmit();
        }}
        {...(busy ? { loading: true } : {})}
      >
        Save
      </s-button>
      ) : null}

      {error ? (
        <s-banner tone="critical" heading="Cache action failed">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      ) : null}
      {message ? (
        <s-banner tone="success" heading="Updated">
          <s-paragraph>{message}</s-paragraph>
        </s-banner>
      ) : null}

      <s-section>
        <AppTabBar
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "clear", label: "Clear cache" },
            { id: "settings", label: "TTL & switches" },
            { id: "urls", label: "URLs" },
            { id: "logs", label: "Logs" },
          ]}
        />
      </s-section>

      {tab === "clear" ? (
      <s-section heading="Clear cache">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Clears this shop’s Redis GraphQL + CMS keys, purges listed CDN URLs
            (if Cloudflare tokens are set), and flushes India 8088 when
            CATALOG_CACHE_FLUSH_URL is configured. Does not FLUSHALL Redis.
          </s-paragraph>
          <s-stack direction="inline" gap="small">
            <fetcher.Form
              method="post"
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    "Clear all catalog/CMS cache for this shop? Shoppers may MISS until cron warms again.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="clear_all" />
              <s-button type="submit" variant="primary" tone="critical" {...(busy ? { loading: true } : {})}>
                Clear all cache
              </s-button>
            </fetcher.Form>
            <s-button
              variant="secondary"
              onClick={() => {
                const form = document.createElement("form");
                const intent = document.createElement("input");
                intent.name = "intent";
                intent.value = "warm_all";
                form.appendChild(intent);
                fetcher.submit(form, { method: "post" });
              }}
            >
              Warm listed URLs
            </s-button>
          </s-stack>

          <s-divider></s-divider>

          <s-paragraph>
            Granular clear: target one product, one collection, or one URL.
            “Clear &amp; re-warm” refills Redis + edge immediately so the next
            shopper is a HIT. Result shows cache status before → after.
          </s-paragraph>

          <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="clear_product" />
              <s-stack direction="block" gap="small">
                <s-text-field
                  label="Product (GID, ID, or handle)"
                  name="target"
                  placeholder="gid://shopify/Product/… or my-product"
                ></s-text-field>
                <s-checkbox label="Re-warm after clear" name="rewarm"></s-checkbox>
                <s-button type="submit" variant="secondary" {...(busy ? { loading: true } : {})}>
                  Clear product
                </s-button>
              </s-stack>
            </fetcher.Form>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="clear_collection" />
              <s-stack direction="block" gap="small">
                <s-text-field
                  label="Collection (GID, ID, or handle)"
                  name="target"
                  placeholder="gid://shopify/Collection/… or summer-sale"
                ></s-text-field>
                <s-checkbox label="Re-warm after clear" name="rewarm"></s-checkbox>
                <s-button type="submit" variant="secondary" {...(busy ? { loading: true } : {})}>
                  Clear collection
                </s-button>
              </s-stack>
            </fetcher.Form>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="clear_scoped_url" />
              <s-stack direction="block" gap="small">
                <s-text-field
                  label="URL or path"
                  name="url"
                  placeholder="/cms/pages, /cms/settings, /graphql?sha256=…"
                ></s-text-field>
                <s-checkbox label="Re-warm after clear" name="rewarm"></s-checkbox>
                <s-button type="submit" variant="secondary" {...(busy ? { loading: true } : {})}>
                  Clear URL
                </s-button>
              </s-stack>
            </fetcher.Form>
          </s-grid>
        </s-stack>
      </s-section>
      ) : null}

      {tab === "settings" ? (
      <s-section heading="Cache configuration">
        <fetcher.Form id="cache-config-form" method="post">
          <input type="hidden" name="intent" value="save_config" />
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Redis and Cloudflare/Vercel keep public GET APIs for 10–30
              minutes. Cron pre-builds every collection and product URL so the
              first shopper is a cache HIT. India nginx is required for 10–20ms.
            </s-paragraph>
            <s-checkbox
              label="Redis cache"
              name="redisEnabled"
              checked={config.redisEnabled}
            ></s-checkbox>
            <s-checkbox
              label="CDN cache (Vercel / Cloudflare)"
              name="cdnEnabled"
              checked={config.cdnEnabled}
            ></s-checkbox>
            <s-checkbox
              label="Auto-refresh every 5 minutes"
              name="warmerEnabled"
              checked={config.warmerEnabled}
            ></s-checkbox>
            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                <s-text-field
                  label="Redis + Cloudflare TTL (seconds, 600–1800)"
                  name="ttlSeconds"
                  value={String(config.ttlSeconds)}
                ></s-text-field>
                <s-text-field
                  label="Stale-while-revalidate (seconds, 600–1800)"
                  name="swrSeconds"
                  value={String(config.swrSeconds)}
                ></s-text-field>
                <s-text-field
                  label="Cron refresh (fixed 300s / 5 min)"
                  name="refreshIntervalSeconds"
                  value="300"
                  disabled
                ></s-text-field>
            </s-grid>
          </s-stack>
        </fetcher.Form>
      </s-section>
      ) : null}

      {tab === "urls" ? (
      <s-section heading="Cached URLs">
        <s-stack direction="block" gap="base">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="create_url" />
            <s-stack direction="block" gap="small">
              <s-text-field
                label="Label"
                name="label"
                placeholder="Collection page"
              ></s-text-field>
              <s-text-field
                label="Public URL"
                name="url"
                placeholder="/graphql?sha256=…&variables=… or /cms/pages"
              ></s-text-field>
              <s-text-area
                label="GraphQL query (optional — required once so cron can register APQ)"
                name="queryText"
                placeholder="query ProductsByCollectionId($id: ID!, $first: Int!) { … }"
              ></s-text-area>
              <s-paragraph>
                Cron every 5 minutes: re-registers each query in Redis, refreshes Redis
                payloads, then GET-fills Vercel (and Cloudflare if the hostname is proxied).
                Add one URL per variable set the app actually uses.
              </s-paragraph>
              <s-stack direction="inline" gap="small">
                <s-button type="submit" variant="primary" {...(busy ? { loading: true } : {})}>
                  Add URL
                </s-button>
                <s-button
                  variant="secondary"
                  onClick={() => {
                    const form = document.createElement("form");
                    const intent = document.createElement("input");
                    intent.name = "intent";
                    intent.value = "warm_all";
                    form.appendChild(intent);
                    fetcher.submit(form, { method: "post" });
                  }}
                >
                  Refresh all now
                </s-button>
              </s-stack>
            </s-stack>
          </fetcher.Form>

          {urls.length === 0 ? (
            <s-paragraph>No cached URLs yet.</s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Label</s-table-header>
                <s-table-header>URL</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Hits</s-table-header>
                <s-table-header>Misses</s-table-header>
                <s-table-header>Last warm</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {urls.map((row) => (
                  <s-table-row key={row.id}>
                    <s-table-cell>{row.label}</s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">
                        {row.url.length > 64 ? `${row.url.slice(0, 64)}…` : row.url}
                      </s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge>{row.kind}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{row.liveHits}</s-table-cell>
                    <s-table-cell>{row.liveMisses}</s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{formatTime(row.lastWarmedAt)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small">
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="clear_url" />
                          <input type="hidden" name="id" value={row.id} />
                          <s-button
                            type="submit"
                            variant="tertiary"
                            onClick={(event) => {
                              if (
                                !window.confirm(
                                  `Clear cache for “${row.label}” only? Other URLs stay cached.`,
                                )
                              ) {
                                event.preventDefault();
                              }
                            }}
                          >
                            Clear
                          </s-button>
                        </fetcher.Form>
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="warm_url" />
                          <input type="hidden" name="id" value={row.id} />
                          <s-button type="submit" variant="tertiary">
                            Refresh
                          </s-button>
                        </fetcher.Form>
                        <fetcher.Form
                          method="post"
                          onSubmit={(event) => {
                            if (!window.confirm(`Remove “${row.label}” from the list?`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="intent" value="delete_url" />
                          <input type="hidden" name="id" value={row.id} />
                          <s-button type="submit" variant="tertiary" tone="critical">
                            Delete
                          </s-button>
                        </fetcher.Form>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-stack>
      </s-section>
      ) : null}

      {tab === "logs" ? (
      <s-section heading="Cache logs">
        {logs.length === 0 ? (
          <s-paragraph>No cache actions yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Time</s-table-header>
              <s-table-header>Action</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Duration</s-table-header>
              <s-table-header>Detail</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {logs.map((log) => (
                <s-table-row key={log.id}>
                  <s-table-cell>
                    <s-text color="subdued">{formatTime(log.createdAt)}</s-text>
                  </s-table-cell>
                  <s-table-cell>{log.action}</s-table-cell>
                  <s-table-cell>
                    {log.status === "ok" ? (
                      <s-badge tone="success">ok</s-badge>
                    ) : log.status === "skipped" ? (
                      <s-badge>skipped</s-badge>
                    ) : (
                      <s-badge tone="critical">{log.status}</s-badge>
                    )}
                  </s-table-cell>
                  <s-table-cell>{log.durationMs}ms</s-table-cell>
                  <s-table-cell>
                    <s-text color="subdued">{log.message || "—"}</s-text>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
      ) : null}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

