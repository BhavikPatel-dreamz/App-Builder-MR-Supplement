/**
 * Full ProductsByCollectionId query fixture — matches production mobile app shape.
 * Used for contract tests; NOT registered as the only allowed query.
 */
export const PRODUCTS_BY_COLLECTION_FULL_QUERY = `query ProductsByCollectionId(
  $id: ID!,
  $first: Int,
  $after: String,
  $sortKey: ProductCollectionSortKeys,
  $reverse: Boolean,
  $filters: [ProductFilter!]
) {
  collection(id: $id) {
    title
    handle
    products(
      first: $first,
      after: $after,
      sortKey: $sortKey,
      reverse: $reverse,
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
          description
          vendor
          productType
          tags
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
              { namespace: "custom", key: "start_date" }
              { namespace: "custom", key: "end_date" }
              { namespace: "custom", key: "disable_online_sale" }
              { namespace: "custom", key: "yagna_details" }
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
                }
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price {
                  amount
                  currencyCode
                }
                availableForSale
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export const COLLECTION_VARIABLES_PAGE1 = {
  id: "gid://shopify/Collection/568648040759",
  first: 250,
  after: null,
  sortKey: "COLLECTION_DEFAULT",
  reverse: false,
  filters: [] as unknown[],
};

/** Sample Shopify response — nested structure must pass through unchanged. */
export function sampleShopifyCollectionResponse() {
  return {
    data: {
      collection: {
        title: "Featured",
        handle: "featured",
        products: {
          pageInfo: {
            hasNextPage: true,
            endCursor: "eyJsYXN0X2lkIjo123",
          },
          filters: [],
          edges: [
            {
              node: {
                id: "gid://shopify/Product/1",
                title: "Test Product",
                handle: "test-product",
                description: "Desc",
                vendor: "Appbuilder",
                productType: "Saree",
                tags: ["silk"],
                images: { edges: [] },
                metafields: [
                  {
                    key: "start_date",
                    namespace: "custom",
                    value: "2026-01-01",
                    type: "single_line_text_field",
                    reference: null,
                  },
                ],
                variants: {
                  edges: [
                    {
                      node: {
                        id: "gid://shopify/ProductVariant/1",
                        title: "Default",
                        sku: "SKU-1",
                        price: { amount: "1000.0", currencyCode: "INR" },
                        availableForSale: true,
                        selectedOptions: [{ name: "Size", value: "M" }],
                        image: { url: "https://cdn.shopify.com/x.jpg", altText: null },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
    extensions: {
      cost: {
        requestedQueryCost: 100,
        actualQueryCost: 50,
      },
    },
  };
}
