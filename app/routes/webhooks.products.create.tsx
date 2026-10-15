import type { ActionFunctionArgs } from "react-router";

import { handleCatalogWebhook } from "../lib/protection/webhook-invalidation.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleCatalogWebhook(request, "products/create");
};
