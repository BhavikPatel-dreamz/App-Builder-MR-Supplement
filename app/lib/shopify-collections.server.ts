type ShopifyAdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type CollectionProduct = {
  id: string;
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: string;
  currencyCode?: string;
};

const COLLECTION_PRODUCTS_QUERY = `#graphql
  query CmsCollectionProducts($id: ID!, $first: Int!) {
    collection(id: $id) {
      products(first: $first) {
        edges {
          node {
            id
            title
            featuredImage {
              url
              altText
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }`;

function toCollectionGid(collectionId: string): string {
  if (collectionId.startsWith("gid://")) {
    return collectionId;
  }

  return `gid://shopify/Collection/${collectionId}`;
}

function formatPrice(amount: string, currencyCode: string): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return amount;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(value);
  } catch {
    return `${currencyCode} ${amount}`;
  }
}

export async function listCollectionProducts(
  admin: ShopifyAdminClient,
  collectionId: string,
  limit = 12,
): Promise<CollectionProduct[]> {
  const first = Math.min(Math.max(limit, 1), 50);
  const response = await admin.graphql(COLLECTION_PRODUCTS_QUERY, {
    variables: {
      id: toCollectionGid(collectionId),
      first,
    },
  });

  const payload = await response.json();

  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Failed to load collection products.");
  }

  if (!payload?.data?.collection) {
    return [];
  }

  const edges = payload.data.collection.products?.edges ?? [];

  return edges
    .map(
      (edge: {
        node?: {
          id?: string;
          title?: string;
          featuredImage?: { url?: string | null; altText?: string | null } | null;
          priceRangeV2?: {
            minVariantPrice?: { amount?: string; currencyCode?: string } | null;
          } | null;
        };
      }) => {
        const node = edge?.node;
        if (!node?.id || !node.title) {
          return null;
        }

        const amount = node.priceRangeV2?.minVariantPrice?.amount;
        const currencyCode = node.priceRangeV2?.minVariantPrice?.currencyCode;

        return {
          id: node.id,
          title: node.title,
          imageUrl: node.featuredImage?.url ?? undefined,
          imageAlt: node.featuredImage?.altText ?? node.title,
          price: amount && currencyCode ? formatPrice(amount, currencyCode) : undefined,
          currencyCode,
        } satisfies CollectionProduct;
      },
    )
    .filter(Boolean) as CollectionProduct[];
}
