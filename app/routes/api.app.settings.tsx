import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  buildTodaysAffirmationPublicPayload,
  buildTodaysMeditationPublicPayload,
  getShopSettings,
  toPublicShopSettings,
  upsertShopSettings,
  type ShopSettingsInput,
} from "../lib/settings.server";
import {
  parseCollectionRef,
  parseProductRef,
} from "../lib/settings-resources";
import { parseBottomTabs, parseTabBackgroundColor } from "../lib/bottom-tabs";
import { parseHomePageSettings } from "../lib/home-page-settings";
import { parseCartSettings } from "../lib/cart-settings";
import { parseSearchSettings } from "../lib/search-settings";
import { parseProductDetailsSettings } from "../lib/product-details-settings";
import { parseCacheSettings } from "../lib/cache-policy.server";
import { authenticate } from "../shopify.server";

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseSettingsBody(body: unknown): ShopSettingsInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Record<string, unknown>;

  return {
    androidAppVersion: String(input.androidAppVersion ?? ""),
    androidPlayStoreUrl: String(input.androidPlayStoreUrl ?? ""),
    androidForceUpdateEnabled: parseBoolean(input.androidForceUpdateEnabled),
    iosAppVersion: String(input.iosAppVersion ?? ""),
    iosAppStoreUrl: String(input.iosAppStoreUrl ?? ""),
    iosForceUpdateEnabled: parseBoolean(input.iosForceUpdateEnabled),
    backgroundMusicFileUrl: String(input.backgroundMusicFileUrl ?? ""),
    backgroundMusicUrl: String(input.backgroundMusicUrl ?? ""),
    productsTabCollection: parseCollectionRef(input.productsTabCollection),
    coursesTabCollection: parseCollectionRef(input.coursesTabCollection),
    yagnasTabCollection: parseCollectionRef(input.yagnasTabCollection),
    yagnasTabProduct: parseProductRef(input.yagnasTabProduct),
    todaysMeditationDefaultImageUrl: String(input.todaysMeditationDefaultImageUrl ?? ""),
    todaysMeditationEntries: Array.isArray(input.todaysMeditationEntries) ? input.todaysMeditationEntries : [],
    todaysAffirmationDefaultImageUrl: String(input.todaysAffirmationDefaultImageUrl ?? ""),
    todaysAffirmationEntries: Array.isArray(input.todaysAffirmationEntries) ? input.todaysAffirmationEntries : [],
    tabBackgroundColor: parseTabBackgroundColor(input.tabBackgroundColor),
    bottomTabs: parseBottomTabs(input.bottomTabs ?? input.tabs),
    homePageSettings: parseHomePageSettings(
      input.homePageSettings ?? input.homePage,
    ),
    cartSettings: parseCartSettings(
      input.cartSettings ?? input.cart ?? input.Cart,
    ),
    searchSettings: parseSearchSettings(
      input.searchSettings ?? input.search,
    ),
    productDetails: parseProductDetailsSettings(
      input.productDetails ?? input.ProductDetails,
    ),
    cacheSettings: parseCacheSettings(input.cacheSettings),
    appstleLoyaltyToken: String(
      input.appstleLoyaltyToken ??
        (input.appstle as { appstleLoyaltyToken?: unknown } | undefined)
          ?.appstleLoyaltyToken ??
        "",
    ),
    appstleLoyaltyApiUrl: String(
      input.appstleLoyaltyApiUrl ??
        (input.appstle as { appstleLoyaltyApiUrl?: unknown } | undefined)
          ?.appstleLoyaltyApiUrl ??
        "",
    ),
    trustpilotApiKey: String(
      input.trustpilotApiKey ??
        (input.trustpilot as { trustpilotApiKey?: unknown } | undefined)
          ?.trustpilotApiKey ??
        "",
    ),
    trustpilotBaseUrl: String(
      input.trustpilotBaseUrl ??
        (input.trustpilot as { trustpilotBaseUrl?: unknown } | undefined)
          ?.trustpilotBaseUrl ??
        "",
    ),
    writeReviewUrl: String(
      input.writeReviewUrl ??
        (input.reviews as { writeReviewUrl?: unknown } | undefined)
          ?.writeReviewUrl ??
        "",
    ),
    getReviewUrl: String(
      input.getReviewUrl ??
        (input.reviews as { getReviewUrl?: unknown } | undefined)
          ?.getReviewUrl ??
        "",
    ),
  };
}

function buildSettingsResponse(settings: ShopSettingsInput) {
  const publicSettings = toPublicShopSettings(settings);

  return {
    success: true,
    settings,
    todaysMeditation: buildTodaysMeditationPublicPayload(settings),
    todaysAffirmation: buildTodaysAffirmationPublicPayload(settings),
    public: publicSettings,
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);

  return Response.json(buildSettingsResponse(settings));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "PUT" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseSettingsBody(body);
  if (!input) {
    return Response.json({ error: "Invalid settings payload." }, { status: 400 });
  }

  try {
    const settings = await upsertShopSettings(session.shop, input);
    return Response.json(buildSettingsResponse(settings));
  } catch (error) {
    console.error("Failed to save shop settings:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save settings.";
    return Response.json({ error: message }, { status: 500 });
  }
};
