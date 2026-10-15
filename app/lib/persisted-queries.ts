/**
 * Native-app Storefront GraphQL + APQ hashes for GET /graphql?sha256=…
 * Hash = SHA-256 hex of the exact query string (trimmed).
 */

export const PRODUCTS_BY_COLLECTION_ID_QUERY = `query ProductsByCollectionId($id: ID!, $first: Int, $after: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean, $filters: [ProductFilter!]) {
   collection(id: $id) {
     title
     handle
     description
     image {
       url
       altText
       width
       height
     }
     metafields(
       identifiers: [
         { namespace: "custom", key: "max_product_numbering" }
         { namespace: "custom", key: "banner_image" }
         { namespace: "custom", key: "sub_category_collection" }
         { namespace: "custom", key: "display_name" }
         { namespace: "custom", key: "short_description" }
       ]
     ) {
       key
       namespace
       value
       type
       reference {
         ... on MediaImage {
           image {
             url
             altText
             height
             width
           }
         }
       }
       references(first: 10) {
         edges {
           node {
             ... on Collection {
               id
               title
               handle
               metafields(
                 identifiers: [{ namespace: "custom", key: "display_name" }]
               ) {
                 key
                 namespace
                 value
                 type
               }
             }
           }
         }
       }
     }
     products(
       first: $first
       after: $after
       sortKey: $sortKey
       reverse: $reverse
       filters: $filters
     ) {
       pageInfo {
         hasNextPage
         endCursor
       }
       filters {
         id
         label
         type
         values {
           id
           label
           count
           input
         }
       }
       edges {
         node {
           id
           title
           handle
           vendor
           tags
           availableForSale
           publishedAt
           priceRange {
             minVariantPrice {
               amount
               currencyCode
             }
           }
           images(first: 1) {
             edges {
               node {
                 id
                 url
                 altText
               }
             }
           }
           metafields(
             identifiers: [
               { namespace: "custom", key: "what_does_this_product_do" }
               { namespace: "custom", key: "special_text" }
               { namespace: "custom", key: "display_name" }
               { namespace: "custom", key: "bundle_products" }
               { namespace: "custom", key: "main_bundle_product" }
               { namespace: "custom", key: "bonus_items" }
               { namespace: "custom", key: "discount__price" }
             ]
           ) {
             key
             namespace
             value
             type
           }
           options(first: 3) {
             name
             optionValues {
               name
             }
           }
           variants(first: 30) {
             edges {
               node {
                 id
                 availableForSale
                 price {
                   amount
                   currencyCode
                 }
                 compareAtPrice {
                   amount
                   currencyCode
                 }
                 image {
                   id
                   url
                   altText
                 }
                 metafields(
                   identifiers: [{ namespace: "custom", key: "free_items" }]
                 ) {
                   namespace
                   key
                   value
                   type
                 }
               }
             }
           }
         }
       }
     }
   }
 }
`;

export const PRODUCTS_BY_COLLECTION_HANDLE_QUERY = `query ProductsByCollection($handle: String!, $first: Int, $after: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean, $filters: [ProductFilter!]) {
  collectionByHandle(handle: $handle) {
    title
    handle
    description
    image {
      url
      altText
      width
      height
    }
    metafields(
      identifiers: [
        { namespace: "custom", key: "max_product_numbering" }
        { namespace: "custom", key: "banner_image" }
        { namespace: "custom", key: "sub_category_collection" }
        { namespace: "custom", key: "display_name" }
        { namespace: "custom", key: "short_description" }
      ]
    ) {
      key
      namespace
      value
      type
      reference {
        ... on MediaImage {
          image {
            url
            altText
            height
            width
          }
        }
      }
      references(first: 10) {
        edges {
          node {
            ... on Collection {
              id
              title
              handle
              metafields(
                identifiers: [{ namespace: "custom", key: "display_name" }]
              ) {
                key
                namespace
                value
                type
              }
            }
          }
        }
      }
    }
    products(
      first: $first
      after: $after
      sortKey: $sortKey
      reverse: $reverse
      filters: $filters
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      filters {
        id
        label
        type
        values {
          id
          label
          count
          input
        }
      }
      edges {
        node {
          id
          title
          handle
          vendor
          tags
          availableForSale
          publishedAt
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          metafields(
            identifiers: [
              { namespace: "custom", key: "what_does_this_product_do" }
              { namespace: "custom", key: "special_text" }
              { namespace: "custom", key: "display_name" }
              { namespace: "custom", key: "bundle_products" }
              { namespace: "custom", key: "main_bundle_product" }
              { namespace: "custom", key: "bonus_items" }
              { namespace: "custom", key: "discount__price" }
            ]
          ) {
            key
            namespace
            value
            type
          }
          options(first: 3) {
            name
            optionValues {
              name
            }
          }
          variants(first: 30) {
            edges {
              node {
                id
                availableForSale
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                image {
                  id
                  url
                  altText
                }
                metafields(
                  identifiers: [{ namespace: "custom", key: "free_items" }]
                ) {
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

export const PRODUCT_BY_ID_QUERY = `query GetProductByProductId($id: ID!) {
  product(id: $id) {
    id
    title
    description
    descriptionHtml
    productType
    tags
    vendor
    onlineStoreUrl
    availableForSale
    priceRange {
      maxVariantPrice {
        amount
        currencyCode
      }
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 20) {
      edges {
        node {
          id
          url
          altText
        }
      }
    }
    media(first: 20) {
    edges {
      node {
        __typename
        id
        alt


        ... on MediaImage {
          image {
            id
            url
            altText
            width
            height
          }
        }


        ... on Video {
          sources {
            url
            mimeType
            format
            height
            width
          }
          previewImage {
            url
            altText
          }
        }
      }
    }
  }


    variants(first: 50) {
      edges {
        node {
          id
          title
          sku
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          availableForSale
          selectedOptions {
            name
            value
          }
          image {
            id
            url
            altText
          }
          metafields(
            identifiers: [
              { namespace: "custom", key: "free_items" }
            ]
          ) {
            namespace
            key
            value
            type
          }
        }
      }
    }


    metafields(
      identifiers: [
        {
          namespace: "shopify--discovery--product_recommendation"
          key: "related_products"
        }
        {
          namespace: "custom"
          key: "characteristic"
        }
        {
          namespace: "custom"
          key: "summary_field"
        }
        {
          namespace: "custom"
          key: "what_does_this_product_do"
        }
        {
          namespace: "custom"
          key: "display_name"
        }
        {
          namespace: "custom"
          key: "subtitle"
        }
        {
          namespace: "custom"
          key: "flavour"
        }
        {
          namespace: "custom"
          key: "q_a"
        }
        {
          namespace: "custom"
          key: "nutritional_panel"
        }
        {
          namespace: "custom"
          key: "main_bundle_product"
        }
        {
          namespace: "custom"
          key: "bundle_products"
        }
        {
          namespace: "custom"
          key: "related_articles"
        }
        {
          namespace: "custom"
          key: "bonus_items"
        }
        {
          namespace: "custom"
          key: "specials_banner"
        }
        {
          namespace: "custom"
          key: "product_review_points"
        }
        {
          namespace: "custom"
          key: "product_review_summary"
        }
        {
          namespace: "reviews"
          key: "imported_reviews"
        }
        {
          namespace: "custom"
          key: "discount__price"
        }
      ]
    ) {
      id
      namespace
      key
      value
      type


      reference {
        __typename
        ... on Metaobject {
          id
          handle
          type


          fields {
            key
            type
            value


            reference {
              ... on MediaImage {
                id
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }


      references(first: 10) {
        nodes {
          __typename
          ... on Metaobject {
            id
            handle
            type


            fields {
              key
              type
              value


              reference {
                ... on MediaImage {
                  id
                  image {
                    url
                    altText
                  }
                }
              }


              references(first: 10) {
                nodes {
                  ... on MediaImage {
                    __typename
                    id
                    image {
                      url
                      altText
                    }
                  }
                  ... on Video {
                    __typename
                    id
                    sources {
                      url
                      mimeType
                      format
                      height
                      width
                    }
                    previewImage {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
          ... on Article {
            id
            title
            handle
            content
            publishedAt
            image {
              url
              altText
            }
            blog {
              title
              handle
            }
          }
        }
      }
    }
  }
}
`;

export const PRODUCT_BY_HANDLE_QUERY = `query GetProductByHandle($handle: String!) {
  productByHandle(handle: $handle) {
    id
    title
    description
    descriptionHtml
    productType
    tags
    vendor
    onlineStoreUrl
    availableForSale
    priceRange {
      maxVariantPrice {
        amount
        currencyCode
      }
      minVariantPrice {
        amount
        currencyCode
      }
    }


    images(first: 20) {
      edges {
        node {
          id
          url
          altText
        }
      }
    }
        media(first: 20) {
    edges {
      node {
        __typename
        id
        alt


        ... on MediaImage {
          image {
            id
            url
            altText
            width
            height
          }
        }


        ... on Video {
          sources {
            url
            mimeType
            format
            height
            width
          }
          previewImage {
            url
            altText
          }
        }
      }
    }
  }
    variants(first: 50) {
      edges {
        node {
          id
          title
          sku
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          availableForSale
          selectedOptions {
            name
            value
          }
          image {
            id
            url
            altText
          }
          metafields(
            identifiers: [
              { namespace: "custom", key: "free_items" }
            ]
          ) {
            namespace
            key
            value
            type
          }
        }
      }
    }


    metafields(
      identifiers: [
        {
          namespace: "shopify--discovery--product_recommendation"
          key: "related_products"
        }
        {
          namespace: "custom"
          key: "characteristic"
        }
        {
          namespace: "custom"
          key: "summary_field"
        }
        {
          namespace: "custom"
          key: "what_does_this_product_do"
        }
        {
          namespace: "custom"
          key: "display_name"
        }
        {
          namespace: "custom"
          key: "subtitle"
        }
        {
          namespace: "custom"
          key: "flavour"
        }
        {
          namespace: "custom"
          key: "q_a"
        }
        {
          namespace: "custom"
          key: "nutritional_panel"
        }
        {
          namespace: "custom"
          key: "main_bundle_product"
        }
            {
          namespace: "custom"
          key: "bundle_products"
        }
            {
          namespace: "custom"
          key: "related_articles"
        }
        {
          namespace: "custom"
          key: "bonus_items"
        }
        {
          namespace: "custom"
          key: "specials_banner"
        }
        {
          namespace: "custom"
          key: "product_review_points"
        }
        {
          namespace: "custom"
          key: "product_review_summary"
        }
        {
          namespace: "reviews"
          key: "imported_reviews"
        }
        {
          namespace: "custom"
          key: "discount__price"
        }
      ]
    ) {
      id
      namespace
      key
      value
      type


      reference {
        __typename
        ... on Metaobject {
          id
          handle
          type


          fields {
            key
            type
            value


            reference {
              ... on MediaImage {
                id
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }


      references(first: 10) {
        nodes {
          __typename
          ... on Metaobject {
            id
            handle
            type


            fields {
              key
              type
              value


              reference {
                ... on MediaImage {
                  id
                  image {
                    url
                    altText
                  }
                }
              }


              references(first: 10) {
                nodes {
                  ... on MediaImage {
                    __typename
                    id
                    image {
                      url
                      altText
                    }
                  }
                  ... on Video {
                    __typename
                    id
                    sources {
                      url
                      mimeType
                      format
                      height
                      width
                    }
                    previewImage {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
          ... on Article {
            id
            title
            handle
            content
            publishedAt
            image {
              url
              altText
            }
            blog {
              title
              handle
            }
          }
        }
      }
    }
  }
}
`;

export const PRODUCTS_BY_IDS_QUERY = `query getProductsByIds($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Product {
      id
      title
      handle
      tags
      vendor
      availableForSale
      publishedAt
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 1) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
      options(first: 3) {
        name
        optionValues {
          name
        }
      }
      variants(first: 30) {
        edges {
          node {
            id
            title
            availableForSale
            selectedOptions {
              name
              value
            }
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
            image {
              id
              url
              altText
            }
            metafields(
              identifiers: [{ namespace: "custom", key: "free_items" }]
            ) {
              namespace
              key
              value
              type
            }
          }
        }
      }
      metafields(
        identifiers: [
          { namespace: "custom", key: "what_does_this_product_do" }
          { namespace: "custom", key: "display_name" }
          { namespace: "custom", key: "nutritional_panel" }
          { namespace: "custom", key: "bundle_products" }
          { namespace: "custom", key: "main_bundle_product" }
          { namespace: "custom", key: "bonus_items" }
          { namespace: "custom", key: "discount__price" }
        ]
      ) {
        key
        namespace
        value
        type
      }
    }
  }
}
`;

/** Filled by sha256 of trimmed query; keep in sync with STOREFRONT_PQ. */
export const PRODUCTS_BY_COLLECTION_ID_SHA256 =
  "7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871";
export const PRODUCTS_BY_COLLECTION_HANDLE_SHA256 =
  "5857d1f281469b9b3923f81d15e41d5a72790d847e074d9e0f0d6d690f76a279";
export const PRODUCT_BY_ID_SHA256 =
  "2c8cbf5948d3e5560c38b9b866bd79b56eaf795e7e56a6f302ff58301ac5cc93";
export const PRODUCT_BY_HANDLE_SHA256 =
  "05f53f406858a1e025dac342c9769d20da451daf4071b4ee3117164e5c356215";
export const PRODUCTS_BY_IDS_SHA256 =
  "3dee64be90e676c413abe7f1660366826e8296c1866f584aade05fbd8fee5ab3";

/** Previous native hashes still aliased to the same catalog documents. */
export const PERSISTED_QUERY_HASH_ALIASES: Record<string, string[]> = {
  "3dee64be90e676c413abe7f1660366826e8296c1866f584aade05fbd8fee5ab3": [
    "3204e31b14792882020d6a3a4c0d2bf5e0bd5ae7dd2acdb4f8d2d0d8d963ef93",
    "d6708c99e907831d6ba5214808ba0d77a60158df7b4ed937cb795aabb627c16a",
    "4254ab26c100e8e6168bbde0a3f5a6914ea7bbd7fe7a4b88ac7071b278106104",
    "5a68c1548ad13c52499612fdb98ab17680f61c4950fb5caecf467727939df4a7",
  ],
  "2c8cbf5948d3e5560c38b9b866bd79b56eaf795e7e56a6f302ff58301ac5cc93": [
    "0bee0fe9b5b1ef56186c840b0c409d389df3b2040201bf4b082bb663586ea5a1",
    "db65b1e1a74c40f87fd20e01c91c26036f4d5ba40005a755f676ca94a64a2373",
  ],
  "5857d1f281469b9b3923f81d15e41d5a72790d847e074d9e0f0d6d690f76a279": [
    "20e2fece4b46420d1257230e68d5bf987067222e7d5c236739071f8cee5c3509",
    "65f91250468b6795cb02e3e9f85f9b929d1841a790830c7a088cf9e0d722277b",
    "dbd51089214eebfeb88b97da80b1b815235949f7ab3d9c91fab3412183adfe87",
  ],
  "05f53f406858a1e025dac342c9769d20da451daf4071b4ee3117164e5c356215": [
    "be03c62d141c50a9a63001624d79317fa57e39487f92acdab496cd7c6c7c7d84",
    "341efa756f86d5e9b011f136376b5d86e4ea7cda2088fe6e1ffca73be9be3397",
  ],
  "7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871": [
    "8a8c2bc4868e7dca30f2d35d57c36db449451e25b3fbf8d3e99a6ec56b5552ec",
  ],
  "03f6434e8eba2a6e830584941f1a879dd82774ab5e02e42fe1eab3f352b13d69": [
    "9125b2d7d5f2b23bb5e89c147d5ffe998d0b6df1dad99f71ef7a4b6f5f8d63cf",
  ],
  "ca4f2ce38a7ba95a9128752116fe3972fbd5d0005e96baa82998887dbad7cc27": [
    "08a2dd26690ac70e03426caa9829a93994c6cef254f18cdcbfef1b7371812c18",
  ],
};

export const PERSISTED_QUERY_CATALOG = {
  productsByCollectionId: {
    name: "ProductsByCollectionId",
    query: PRODUCTS_BY_COLLECTION_ID_QUERY,
    sha256: PRODUCTS_BY_COLLECTION_ID_SHA256,
  },
  productsByCollectionHandle: {
    name: "ProductsByCollection",
    query: PRODUCTS_BY_COLLECTION_HANDLE_QUERY,
    sha256: PRODUCTS_BY_COLLECTION_HANDLE_SHA256,
  },
  productById: {
    name: "GetProductByProductId",
    query: PRODUCT_BY_ID_QUERY,
    sha256: PRODUCT_BY_ID_SHA256,
  },
  productByHandle: {
    name: "GetProductByHandle",
    query: PRODUCT_BY_HANDLE_QUERY,
    sha256: PRODUCT_BY_HANDLE_SHA256,
  },
  productsByIds: {
    name: "getProductsByIds",
    query: PRODUCTS_BY_IDS_QUERY,
    sha256: PRODUCTS_BY_IDS_SHA256,
  },
} as const;

export type PersistedQueryEntry = {
  name: string;
  query: string;
  sha256: string;
};

export type PersistedQueryOp = keyof typeof PERSISTED_QUERY_CATALOG;

const OP_ALIASES: Record<string, PersistedQueryOp> = {
  productsbycollectionid: "productsByCollectionId",
  collection: "productsByCollectionId",
  collectionid: "productsByCollectionId",
  productsbycollectionidquery: "productsByCollectionId",
  productsbycollection: "productsByCollectionHandle",
  productsbycollectionhandle: "productsByCollectionHandle",
  collectionhandle: "productsByCollectionHandle",
  getproductbyproductid: "productById",
  productbyid: "productById",
  product: "productById",
  getproductbyhandle: "productByHandle",
  productbyhandle: "productByHandle",
  getproductsbyids: "productsByIds",
  productsbyids: "productsByIds",
  ids: "productsByIds",
};

export function lookupCatalogOp(op: string | null | undefined): PersistedQueryEntry | null {
  if (!op) return null;
  const key = op.trim();
  if (key in PERSISTED_QUERY_CATALOG) {
    return PERSISTED_QUERY_CATALOG[key as PersistedQueryOp];
  }
  const alias = OP_ALIASES[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
  return alias ? PERSISTED_QUERY_CATALOG[alias] : null;
}

export function publicQueryCatalog() {
  return (Object.keys(PERSISTED_QUERY_CATALOG) as PersistedQueryOp[]).map((op) => {
    const entry = PERSISTED_QUERY_CATALOG[op];
    return { op, name: entry.name, sha256: entry.sha256 };
  });
}

export function allPersistedQueries(): PersistedQueryEntry[] {
  return Object.values(PERSISTED_QUERY_CATALOG).filter(
    (e): e is PersistedQueryEntry => typeof e.sha256 === "string" && e.sha256.length > 0,
  );
}

/**
 * Maps variables to a built-in catalog document. Unknown hashes do not use
 * this. GET ?sha256= with no stored query returns PersistedQueryNotFound.
 */
export function fallbackCatalogQuery(
  variables?: Record<string, unknown>,
): PersistedQueryEntry | null {
  if (!variables || typeof variables !== "object") {
    return PERSISTED_QUERY_CATALOG.productsByCollectionId;
  }
  if (Array.isArray(variables.ids)) return PERSISTED_QUERY_CATALOG.productsByIds;
  const id = String(variables.id || "");
  if (id.includes("/Collection/")) return PERSISTED_QUERY_CATALOG.productsByCollectionId;
  if (id.includes("/Product/")) return PERSISTED_QUERY_CATALOG.productById;
  if (typeof variables.handle === "string") {
    if (
      "first" in variables ||
      "filters" in variables ||
      "sortKey" in variables ||
      "after" in variables
    ) {
      return PERSISTED_QUERY_CATALOG.productsByCollectionHandle;
    }
    return PERSISTED_QUERY_CATALOG.productByHandle;
  }
  return PERSISTED_QUERY_CATALOG.productsByCollectionId;
}
