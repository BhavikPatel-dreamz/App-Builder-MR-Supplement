import type { LoaderFunctionArgs } from "react-router";

import { getShopSettings, toPublicShopSettings } from "../lib/settings.server";
import { authenticate } from "../shopify.server";

/**
 * Signed App Proxy endpoint for mobile app settings.
 *
 * Storefront URL: https://{shop}.myshopify.com/apps/cms/settings
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const shop =
    session?.shop ?? new URL(request.url).searchParams.get("shop") ?? "";

  if (!shop) {
    return Response.json({ error: "Shop could not be resolved." }, { status: 400 });
  }

  const settings = await getShopSettings(shop);
  const publicSettings = toPublicShopSettings(settings);

  return Response.json(
    {
      success: true,
      settings: publicSettings,
      todaysMeditation: publicSettings.todaysMeditation,
      todaysAffirmation: publicSettings.todaysAffirmation,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
};
