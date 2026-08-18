import type { LoaderFunctionArgs } from "react-router";

import { listCollectionProducts } from "../lib/shopify-collections.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const collectionId = url.searchParams.get("collectionId")?.trim() ?? "";
  const limit = Number(url.searchParams.get("limit") || "12");

  if (!collectionId) {
    return Response.json({ error: "collectionId is required." }, { status: 400 });
  }

  try {
    const products = await listCollectionProducts(
      admin,
      collectionId,
      Number.isFinite(limit) && limit > 0 ? limit : 12,
    );

    return Response.json({ products });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load collection products.",
      },
      { status: 500 },
    );
  }
};
