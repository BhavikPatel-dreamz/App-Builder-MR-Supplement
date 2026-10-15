import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { STOREFRONT_PQ, collectionByIdVariables } from "../lib/storefront-query-hashes";

type CatalogHost = {
  catalogHost: string;
  originHost: string;
};

export function loader(_args: LoaderFunctionArgs): CatalogHost {
  const catalogHost = (
    process.env.CACHE_INDIA_WARM_HOST ||
    process.env.CACHE_INDIA_PURGE_HOST ||
    "https://cache.dreamzapps.com"
  ).replace(/\/$/, "");
  const originHost = (
    process.env.SHOPIFY_APP_URL || "https://appbuilder.dreamzapps.com"
  ).replace(/\/$/, "");
  return { catalogHost, originHost };
}

export function meta() {
  return [{ title: "Catalog demo" }];
}

const FIRST = 10;

const LIST_COLLECTIONS = `query CatalogDemoCollections($first: Int!) {
  collections(first: $first) {
    edges {
      node {
        id
        title
        handle
        image { url altText }
      }
    }
  }
}`;

function pqUrl(host: string, sha256: string, variablesJson: string): string {
  return `${host}/graphql?sha256=${sha256}&variables=${encodeURIComponent(variablesJson)}`;
}

function queryUrl(host: string, query: string, variables: Record<string, unknown>): string {
  return `${host}/graphql?query=${encodeURIComponent(query)}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
}

type Timing = {
  ms: number;
  url: string;
  india?: string | null;
  origin?: string | null;
  cf?: string | null;
};

type CollectionCard = {
  id: string;
  title: string;
  handle: string;
  image?: { url?: string; altText?: string | null } | null;
};

type GqlProduct = {
  id: string;
  title: string;
  handle: string;
  vendor?: string;
  description?: string | null;
  images?: { edges?: Array<{ node?: { url?: string; altText?: string | null } }> };
  priceRange?: { minVariantPrice?: { amount: string; currencyCode: string } };
};

type GqlCollection = {
  title?: string;
  handle?: string;
  description?: string | null;
  image?: { url?: string; altText?: string | null } | null;
  metafields?: Array<{
    key?: string | null;
    references?: {
      edges?: Array<{
        node?: {
          id?: string;
          title?: string;
          handle?: string;
          metafields?: Array<{ key?: string; value?: string | null } | null>;
        };
      }>;
    };
  } | null>;
  products?: { edges?: Array<{ node: GqlProduct }> };
};

type View =
  | { name: "list" }
  | { name: "collection"; id: string; handle: string; title: string }
  | {
      name: "product";
      id: string;
      handle: string;
      title: string;
      collectionId: string;
      collectionHandle: string;
      collectionTitle: string;
    };

function productImage(p: GqlProduct | null | undefined) {
  const node = p?.images?.edges?.[0]?.node;
  if (!node?.url) return null;
  return { url: node.url, alt: node.altText || "" };
}

function subcollections(col: GqlCollection | null) {
  const mf = col?.metafields?.find((m) => m?.key === "sub_category_collection");
  return (mf?.references?.edges ?? [])
    .map((e) => {
      const n = e.node;
      if (!n?.id || !n.handle) return null;
      const name = n.metafields?.find((x) => x?.key === "display_name")?.value;
      return { id: n.id, title: name || n.title || n.handle, handle: n.handle };
    })
    .filter((x): x is CollectionCard => Boolean(x));
}

async function timedGet(url: string): Promise<{ json: unknown; timing: Timing }> {
  const started = performance.now();
  const res = await fetch(url);
  const json = await res.json();
  return {
    json,
    timing: {
      ms: Math.round(performance.now() - started),
      url,
      india: res.headers.get("x-india-cache"),
      origin: res.headers.get("x-cache"),
      cf: res.headers.get("cf-cache-status"),
    },
  };
}

function money(amount?: string, currency?: string) {
  if (!amount) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "AUD",
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency || ""}`;
  }
}

function TimingBar({ last }: { last: Timing | null }) {
  if (!last) return null;
  const tags = [
    last.india && `india ${last.india}`,
    last.origin && `origin ${last.origin}`,
    last.cf && `cf ${last.cf}`,
  ].filter(Boolean);
  return (
    <div className="timing">
      <strong>{last.ms} ms</strong>
      <span>{tags.join(" · ") || "no cache headers"}</span>
    </div>
  );
}

export default function CatalogDemo() {
  const { catalogHost, originHost } = useLoaderData<CatalogHost>();
  const [host, setHost] = useState(catalogHost);
  const [view, setView] = useState<View>({ name: "list" });
  const [last, setLast] = useState<Timing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [collection, setCollection] = useState<(GqlCollection & { products: GqlProduct[] }) | null>(
    null,
  );
  const [product, setProduct] = useState<GqlProduct | null>(null);

  const runGet = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const { json, timing } = await timedGet(url);
      setLast(timing);
      const body = json as {
        errors?: Array<{ message: string }>;
        data?: Record<string, unknown>;
      };
      if (body.errors?.length) setError(body.errors.map((e) => e.message).join("; "));
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    const body = await runGet(queryUrl(host, LIST_COLLECTIONS, { first: 50 }));
    const edges =
      (
        body?.data as {
          collections?: { edges?: Array<{ node: CollectionCard }> };
        }
      )?.collections?.edges ?? [];
    setCollections(edges.map((e) => e.node).filter((c) => c.id && c.handle));
  }, [host, runGet]);

  const loadCollection = useCallback(
    async (item: { id: string; handle: string }) => {
      const url = pqUrl(
        host,
        STOREFRONT_PQ.productsByCollectionId,
        JSON.stringify(collectionByIdVariables(item.id, FIRST)),
      );
      const body = await runGet(url);
      const col =
        (body?.data as { collection?: GqlCollection | null })?.collection ||
        (body?.data as { collectionByHandle?: GqlCollection | null })?.collectionByHandle;
      if (!col) {
        setCollection(null);
        return;
      }
      setCollection({
        ...col,
        products: (col.products?.edges ?? []).map((e) => e.node),
      });
    },
    [host, runGet],
  );

  const loadProduct = useCallback(
    async (item: { id: string }) => {
      const url = pqUrl(
        host,
        STOREFRONT_PQ.productById,
        JSON.stringify({ id: item.id }),
      );
      const body = await runGet(url);
      const node =
        (body?.data as { product?: GqlProduct | null })?.product ||
        (body?.data as { productByHandle?: GqlProduct | null })?.productByHandle;
      setProduct(node ?? null);
    },
    [host, runGet],
  );

  useEffect(() => {
    if (view.name === "list") void loadList();
    if (view.name === "collection") void loadCollection(view);
    if (view.name === "product") void loadProduct(view);
  }, [view, loadList, loadCollection, loadProduct]);

  const heading = useMemo(() => {
    if (view.name === "list") return "Collections";
    return view.title;
  }, [view]);

  const chips = view.name === "collection" ? subcollections(collection) : [];

  return (
    <div className="demo">
      <style>{CSS}</style>
      <header className="top">
        <div className="row">
          {view.name !== "list" ? (
            <button
              type="button"
              className="back"
              onClick={() => {
                if (view.name === "product") {
                  setView({
                    name: "collection",
                    id: view.collectionId,
                    handle: view.collectionHandle,
                    title: view.collectionTitle,
                  });
                  return;
                }
                setView({ name: "list" });
              }}
            >
              Back
            </button>
          ) : (
            <span className="brand">Catalog</span>
          )}
          <h1>{heading}</h1>
        </div>
        <label className="host">
          API
          <select
            value={host}
            onChange={(e) => {
              setHost(e.target.value);
              setView({ name: "list" });
            }}
          >
            <option value={catalogHost}>Mumbai {catalogHost.replace(/^https:\/\//, "")}</option>
            <option value={originHost}>US origin {originHost.replace(/^https:\/\//, "")}</option>
          </select>
        </label>
        <TimingBar last={last} />
        <p className="muted">
          For Mumbai HIT timings open{" "}
          <a href={`${catalogHost}/demo`}>{catalogHost.replace(/^https:\/\//, "")}/demo</a>
          {" "}(same origin — cache headers visible).
        </p>
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="err">{error}</p> : null}
      </header>

      {view.name === "list" ? (
        <ul className="cards">
          {collections.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="card"
                onClick={() =>
                  setView({ name: "collection", id: c.id, handle: c.handle, title: c.title })
                }
              >
                {c.image?.url ? <img src={c.image.url} alt={c.image.altText || ""} /> : <div className="ph" />}
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {view.name === "collection" ? (
        <>
          {collection?.image?.url ? (
            <img className="hero" src={collection.image.url} alt={collection.image.altText || ""} />
          ) : null}
          {collection?.description ? (
            <p className="lede">{collection.description.slice(0, 280)}…</p>
          ) : null}
          {chips.length ? (
            <div className="chips">
              {chips.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  onClick={() =>
                    setView({ name: "collection", id: s.id, handle: s.handle, title: s.title })
                  }
                >
                  {s.title}
                </button>
              ))}
            </div>
          ) : null}
          {!loading && !collection?.products.length ? (
            <p className="err">No products in this collection.</p>
          ) : null}
          <ul className="cards">
            {(collection?.products ?? []).map((p) => {
              const img = productImage(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="card"
                    onClick={() =>
                      setView({
                        name: "product",
                        id: p.id,
                        handle: p.handle,
                        title: p.title,
                        collectionId: view.id,
                        collectionHandle: view.handle,
                        collectionTitle: view.title,
                      })
                    }
                  >
                    {img ? <img src={img.url} alt={img.alt} /> : <div className="ph" />}
                    <span>{p.title}</span>
                    <em>
                      {money(
                        p.priceRange?.minVariantPrice?.amount,
                        p.priceRange?.minVariantPrice?.currencyCode,
                      )}
                    </em>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {view.name === "product" && product ? (
        <article className="pdp">
          {productImage(product) ? (
            <img src={productImage(product)!.url} alt={productImage(product)!.alt} />
          ) : null}
          <p className="vendor">{product.vendor}</p>
          <h2>{product.title}</h2>
          <p className="price">
            {money(
              product.priceRange?.minVariantPrice?.amount,
              product.priceRange?.minVariantPrice?.currencyCode,
            )}
          </p>
          {product.description ? <p className="desc">{product.description}</p> : null}
        </article>
      ) : null}
    </div>
  );
}

const CSS = `
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; }
  .demo { max-width: 480px; margin: 0 auto; padding: 12px 14px 48px; }
  .top { position: sticky; top: 0; background: Canvas; padding-bottom: 8px; z-index: 2; }
  .row { display: flex; align-items: center; gap: 10px; }
  h1 { font-size: 1.15rem; margin: 0; flex: 1; }
  .brand { font-weight: 700; font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase; color: #666; }
  .back, .card, select, .chip { font: inherit; }
  .back { border: 0; background: #eee; border-radius: 999px; padding: 6px 12px; }
  .host { display: flex; flex-direction: column; gap: 4px; font-size: 12px; margin: 10px 0 6px; color: #666; }
  .host select { padding: 8px; border-radius: 8px; border: 1px solid #ccc; }
  .timing { display: flex; gap: 10px; align-items: baseline; background: #111; color: #9f9; padding: 8px 10px; border-radius: 8px; font-variant-numeric: tabular-nums; }
  .timing span { color: #ccc; font-size: 12px; word-break: break-all; }
  .muted { color: #888; font-size: 13px; }
  .err { color: #c00; font-size: 13px; }
  .cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { width: 100%; text-align: left; border: 1px solid #ddd; border-radius: 12px; background: Canvas; padding: 0 0 10px; overflow: hidden; }
  .card img, .ph { width: 100%; aspect-ratio: 1; object-fit: cover; background: #f2f2f2; display: block; }
  .card span, .card em { display: block; padding: 0 8px; }
  .card span { margin-top: 8px; font-size: 13px; font-weight: 600; }
  .card em { font-style: normal; font-size: 12px; color: #555; }
  .hero { width: 100%; border-radius: 12px; max-height: 160px; object-fit: cover; }
  .lede { font-size: 13px; color: #444; line-height: 1.4; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
  .chip { font-size: 12px; border: 1px solid #ccc; background: #f7f7f7; border-radius: 999px; padding: 6px 10px; }
  .vendor { margin: 8px 0 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
  .pdp img { width: 100%; border-radius: 12px; }
  .pdp h2 { margin: 12px 0 4px; font-size: 1.25rem; }
  .price { font-weight: 700; }
  .desc { white-space: pre-wrap; font-size: 14px; line-height: 1.45; color: #333; }
`;
