/**
 * Standalone browser/RN helper — copy into app or load from /storefront-gateway.js
 *
 * Replaces: POST shopify.com/.../graphql.json + storefront token
 * With:     GET appbuilder.dreamzapps.com/graphql?sha256=…&variables=…
 */
(function (global) {
  const DEFAULT_GATEWAY = "https://appbuilder.dreamzapps.com/graphql";

  const QUERIES = {
    productsByCollectionId: {
      sha256: "daea17f2dba59c50c3242ec2587cb33aaaa3b0ef1aa18075b4a9a1ee56b2f8c2",
      query: `query ProductsByCollectionId($id: ID!, $first: Int!) {
  collection(id: $id) {
    title
    products(first: $first) {
      edges { node {
        id title handle availableForSale
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
      } }
    }
  }
}`,
    },
    productByHandle: {
      sha256: "a9099543253991a8e6c4149bb9ff6e1bd5f6444401608cc6176e9bffb95425ca",
      query: `query ProductByHandle($handle: String!) {
  product(handle: $handle) {
    id title handle description availableForSale
    featuredImage { url altText width height }
    priceRange { minVariantPrice { amount currencyCode } }
    variants(first: 50) {
      edges { node {
        id title availableForSale sku
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { url altText }
      } }
    }
    images(first: 20) {
      edges { node { url altText width height } }
    }
  }
}`,
    },
  };

  function buildUrl(gateway, sha256, variables) {
    const params = new URLSearchParams();
    params.set("sha256", sha256);
    params.set("variables", JSON.stringify(variables));
    return gateway + "?" + params.toString();
  }

  function buildFullUrl(gateway, query, variables, sha256) {
    const params = new URLSearchParams();
    if (sha256) params.set("sha256", sha256);
    params.set("query", query);
    params.set("variables", JSON.stringify(variables));
    return gateway + "?" + params.toString();
  }

  function notFound(json) {
    return json && json.errors && json.errors.some(function (e) {
      return String(e.message).indexOf("PersistedQueryNotFound") >= 0;
    });
  }

  async function fetchPersisted(entry, variables, opts) {
    opts = opts || {};
    var gateway = opts.gatewayUrl || DEFAULT_GATEWAY;
    var url = buildUrl(gateway, entry.sha256, variables);
    var res = await fetch(url, { cache: "default" });
    var json = await res.json();
    if (notFound(json) && entry.query) {
      url = buildFullUrl(gateway, entry.query, variables, entry.sha256);
      res = await fetch(url, { cache: "no-store" });
      json = await res.json();
    }
    return json;
  }

  global.RiyasatStorefrontGateway = {
    DEFAULT_GATEWAY: DEFAULT_GATEWAY,
    QUERIES: QUERIES,
    buildUrl: buildUrl,
    fetchPersisted: fetchPersisted,
    fetchCollectionProducts: function (collectionGid, first, opts) {
      return fetchPersisted(
        QUERIES.productsByCollectionId,
        { id: collectionGid, first: first == null ? 250 : first },
        opts,
      );
    },
    fetchProductByHandle: function (handle, opts) {
      return fetchPersisted(QUERIES.productByHandle, { handle: handle }, opts);
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
