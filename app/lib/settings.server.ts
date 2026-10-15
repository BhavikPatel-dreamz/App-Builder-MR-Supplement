import type { ShopSettings } from "@prisma/client";

import db from "../db.server";
import {
  EMPTY_COLLECTION_REF,
  EMPTY_PRODUCT_REF,
  parseCollectionRef,
  parseProductRef,
  type SettingsCollectionRef,
  type SettingsProductRef,
} from "./settings-resources";
import {
  parseBottomTabs,
  parseTabBackgroundColor,
  type BottomTabItem,
  type BottomTabsConfig,
} from "./bottom-tabs";
import {
  DEFAULT_HOME_PAGE_SETTINGS,
  parseHomePageSettings,
  type HomePageSettings,
} from "./home-page-settings";
import {
  DEFAULT_CART_SETTINGS,
  parseCartSettings,
  toPublicCartSettings,
  type CartSettings,
  type PublicCartSettings,
} from "./cart-settings";
import {
  DEFAULT_SEARCH_SETTINGS,
  parseSearchSettings,
  toPublicSearchSettings,
  type PublicSearchSettings,
  type SearchSettings,
} from "./search-settings";
import { invalidateCmsSettingsCache } from "./cms-public-cache.server";
import { parseCacheSettings, type CacheSettings } from "./cache-policy.server";
import {
  DEFAULT_PRODUCT_DETAILS_SETTINGS,
  parseProductDetailsSettings,
  toPublicProductDetailsSettings,
  type ProductDetailsSettings,
  type PublicProductDetailsSettings,
} from "./product-details-settings";

export type ShopSettingsInput = {
  androidAppVersion: string;
  androidPlayStoreUrl: string;
  androidForceUpdateEnabled: boolean;
  iosAppVersion: string;
  iosAppStoreUrl: string;
  iosForceUpdateEnabled: boolean;
  backgroundMusicFileUrl: string;
  backgroundMusicUrl: string;
  productsTabCollection: SettingsCollectionRef;
  coursesTabCollection: SettingsCollectionRef;
  yagnasTabCollection: SettingsCollectionRef;
  yagnasTabProduct: SettingsProductRef;
  todaysMeditationDefaultImageUrl: string;
  todaysMeditationEntries: any;
  todaysAffirmationDefaultImageUrl: string;
  todaysAffirmationEntries: any;
  tabBackgroundColor: string;
  bottomTabs: BottomTabItem[];
  homePageSettings: HomePageSettings;
  cartSettings: CartSettings;
  searchSettings: SearchSettings;
  productDetails: ProductDetailsSettings;
  cacheSettings: CacheSettings;
  appstleLoyaltyToken: string;
  appstleLoyaltyApiUrl: string;
  trustpilotApiKey: string;
  trustpilotBaseUrl: string;
  writeReviewUrl: string;
  getReviewUrl: string;
};

export type PublicAppstleSettings = {
  appstleLoyaltyToken: string;
  appstleLoyaltyApiUrl: string;
};

export type PublicTrustpilotSettings = {
  trustpilotApiKey: string;
  trustpilotBaseUrl: string;
};

export type PublicReviewsSettings = {
  writeReviewUrl: string;
  getReviewUrl: string;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettingsInput = {
  androidAppVersion: "",
  androidPlayStoreUrl: "",
  androidForceUpdateEnabled: false,
  iosAppVersion: "",
  iosAppStoreUrl: "",
  iosForceUpdateEnabled: false,
  backgroundMusicFileUrl: "",
  backgroundMusicUrl: "",
  productsTabCollection: { ...EMPTY_COLLECTION_REF },
  coursesTabCollection: { ...EMPTY_COLLECTION_REF },
  yagnasTabCollection: { ...EMPTY_COLLECTION_REF },
  yagnasTabProduct: { ...EMPTY_PRODUCT_REF },
  todaysMeditationDefaultImageUrl: "",
  todaysMeditationEntries: [],
  todaysAffirmationDefaultImageUrl: "",
  todaysAffirmationEntries: [],
  tabBackgroundColor: "#ffffff",
  bottomTabs: [],
  homePageSettings: {
    ...DEFAULT_HOME_PAGE_SETTINGS,
    topMarquee: { ...DEFAULT_HOME_PAGE_SETTINGS.topMarquee, items: [] },
  },
  cartSettings: {
    ...DEFAULT_CART_SETTINGS,
    cartFreeShippingProgressbar: {
      ...DEFAULT_CART_SETTINGS.cartFreeShippingProgressbar,
    },
    cartHandyItems: {
      ...DEFAULT_CART_SETTINGS.cartHandyItems,
      items: [],
    },
  },
  searchSettings: {
    ...DEFAULT_SEARCH_SETTINGS,
    searchbarCollection: { ...EMPTY_COLLECTION_REF },
  },
  productDetails: { ...DEFAULT_PRODUCT_DETAILS_SETTINGS },
  cacheSettings: parseCacheSettings({}),
  appstleLoyaltyToken: "",
  appstleLoyaltyApiUrl: "",
  trustpilotApiKey: "",
  trustpilotBaseUrl: "",
  writeReviewUrl: "",
  getReviewUrl: "",
};

function serializeShopSettings(row: ShopSettings): ShopSettingsInput {
  return {
    androidAppVersion: row.androidAppVersion,
    androidPlayStoreUrl: row.androidPlayStoreUrl,
    androidForceUpdateEnabled: row.androidForceUpdateEnabled,
    iosAppVersion: row.iosAppVersion,
    iosAppStoreUrl: row.iosAppStoreUrl,
    iosForceUpdateEnabled: row.iosForceUpdateEnabled,
    backgroundMusicFileUrl: row.backgroundMusicFileUrl,
    backgroundMusicUrl: row.backgroundMusicUrl,
    productsTabCollection: parseCollectionRef(row.productsTabCollection),
    coursesTabCollection: parseCollectionRef(row.coursesTabCollection),
    yagnasTabCollection: parseCollectionRef(row.yagnasTabCollection),
    yagnasTabProduct: parseProductRef(row.yagnasTabProduct),
    todaysMeditationDefaultImageUrl: row.todaysMeditationDefaultImageUrl || "",
    todaysMeditationEntries: Array.isArray(row.todaysMeditationEntries) ? row.todaysMeditationEntries : [],
    todaysAffirmationDefaultImageUrl: row.todaysAffirmationDefaultImageUrl || "",
    todaysAffirmationEntries: Array.isArray(row.todaysAffirmationEntries) ? row.todaysAffirmationEntries : [],
    tabBackgroundColor: parseTabBackgroundColor(
      (row as ShopSettings & { tabBackgroundColor?: string }).tabBackgroundColor,
    ),
    bottomTabs: parseBottomTabs(
      (row as ShopSettings & { bottomTabs?: unknown }).bottomTabs,
    ),
    homePageSettings: parseHomePageSettings(
      (row as ShopSettings & { homePageSettings?: unknown }).homePageSettings,
    ),
    cartSettings: parseCartSettings(
      (row as ShopSettings & { cartSettings?: unknown }).cartSettings,
    ),
    searchSettings: parseSearchSettings(
      (row as ShopSettings & { searchSettings?: unknown }).searchSettings,
    ),
    productDetails: parseProductDetailsSettings(
      (row as ShopSettings & { productDetails?: unknown }).productDetails,
    ),
    cacheSettings: parseCacheSettings(
      (row as ShopSettings & { cacheSettings?: unknown }).cacheSettings,
    ),
    appstleLoyaltyToken: String(
      (row as ShopSettings & { appstleLoyaltyToken?: string }).appstleLoyaltyToken || "",
    ),
    appstleLoyaltyApiUrl: String(
      (row as ShopSettings & { appstleLoyaltyApiUrl?: string }).appstleLoyaltyApiUrl || "",
    ),
    trustpilotApiKey: String(
      (row as ShopSettings & { trustpilotApiKey?: string }).trustpilotApiKey || "",
    ),
    trustpilotBaseUrl: String(
      (row as ShopSettings & { trustpilotBaseUrl?: string }).trustpilotBaseUrl || "",
    ),
    writeReviewUrl: String(
      (row as ShopSettings & { writeReviewUrl?: string }).writeReviewUrl || "",
    ),
    getReviewUrl: String(
      (row as ShopSettings & { getReviewUrl?: string }).getReviewUrl || "",
    ),
  };
}

export function resolveBackgroundMusicUrl(
  settings: Pick<ShopSettingsInput, "backgroundMusicFileUrl" | "backgroundMusicUrl">,
): string | null {
  const uploaded = settings.backgroundMusicFileUrl.trim();
  if (uploaded) return uploaded;

  const external = settings.backgroundMusicUrl.trim();
  if (external) return external;

  return null;
}

export type PublicShopSettings = {
  forceUpdate: {
    android: {
      appVersion: string;
      storeUrl: string;
      enabled: boolean;
    };
    ios: {
      appVersion: string;
      storeUrl: string;
      enabled: boolean;
    };
  };
  backgroundMusic: {
    url: string | null;
    source: "upload" | "url" | null;
    fileUrl: string | null;
    externalUrl: string | null;
  };
  bottomTabActions: {
    products: {
      collection: SettingsCollectionRef;
    };
    courses: {
      collection: SettingsCollectionRef;
    };
    yagnas: {
      collection: SettingsCollectionRef;
      product: SettingsProductRef;
    };
  };
  todaysMeditation: {
    defaultImageUrl: string | null;
    todayDate: string;
    entries: any[];
    past: any[];
    upcoming: any[];
    today: any | null;
  };
  todaysAffirmation: {
    defaultImageUrl: string | null;
    todayDate: string;
    entries: any[];
    past: any[];
    upcoming: any[];
    today: any | null;
  };
  bottomTab: BottomTabsConfig;
  homePage: HomePageSettings;
  cart: PublicCartSettings;
  search: PublicSearchSettings;
  productDetails: PublicProductDetailsSettings;
  appstle: PublicAppstleSettings;
  trustpilot: PublicTrustpilotSettings;
  reviews: PublicReviewsSettings;
};

export function buildTodaysMeditationPublicPayload(
  settings: Pick<
    ShopSettingsInput,
    "todaysMeditationDefaultImageUrl" | "todaysMeditationEntries"
  >,
) {
  const defaultImage = settings.todaysMeditationDefaultImageUrl.trim();
  const todayDate = new Date().toISOString().slice(0, 10);
  return {
    defaultImageUrl: defaultImage || null,
    todayDate,
    entries: [],
    past: [],
    upcoming: [],
    today: null,
  };
}

export function buildTodaysAffirmationPublicPayload(
  settings: Pick<
    ShopSettingsInput,
    "todaysAffirmationDefaultImageUrl" | "todaysAffirmationEntries"
  >,
) {
  const defaultImage = settings.todaysAffirmationDefaultImageUrl.trim();
  const todayDate = new Date().toISOString().slice(0, 10);
  return {
    defaultImageUrl: defaultImage || null,
    todayDate,
    entries: [],
    past: [],
    upcoming: [],
    today: null,
  };
}

export function toPublicShopSettings(
  settings: ShopSettingsInput,
): PublicShopSettings {
  const uploaded = settings.backgroundMusicFileUrl.trim();
  const external = settings.backgroundMusicUrl.trim();
  const resolvedUrl = resolveBackgroundMusicUrl(settings);

  return {
    forceUpdate: {
      android: {
        appVersion: settings.androidAppVersion,
        storeUrl: settings.androidPlayStoreUrl,
        enabled: settings.androidForceUpdateEnabled,
      },
      ios: {
        appVersion: settings.iosAppVersion,
        storeUrl: settings.iosAppStoreUrl,
        enabled: settings.iosForceUpdateEnabled,
      },
    },
    backgroundMusic: {
      url: resolvedUrl,
      source: uploaded ? "upload" : external ? "url" : null,
      fileUrl: uploaded || null,
      externalUrl: external || null,
    },
    bottomTabActions: {
      products: {
        collection: settings.productsTabCollection,
      },
      courses: {
        collection: settings.coursesTabCollection,
      },
      yagnas: {
        collection: settings.yagnasTabCollection,
        product: settings.yagnasTabProduct,
      },
    },
    todaysMeditation: buildTodaysMeditationPublicPayload(settings),
    todaysAffirmation: buildTodaysAffirmationPublicPayload(settings),
    bottomTab: {
      tabBackgroundColor: parseTabBackgroundColor(settings.tabBackgroundColor),
      tabs: parseBottomTabs(settings.bottomTabs),
    },
    homePage: parseHomePageSettings(settings.homePageSettings),
    cart: toPublicCartSettings(settings.cartSettings),
    search: toPublicSearchSettings(settings.searchSettings),
    productDetails: toPublicProductDetailsSettings(settings.productDetails),
    appstle: {
      appstleLoyaltyToken: settings.appstleLoyaltyToken.trim(),
      appstleLoyaltyApiUrl: settings.appstleLoyaltyApiUrl.trim(),
    },
    trustpilot: {
      trustpilotApiKey: settings.trustpilotApiKey.trim(),
      trustpilotBaseUrl: settings.trustpilotBaseUrl.trim(),
    },
    reviews: {
      writeReviewUrl: settings.writeReviewUrl.trim(),
      getReviewUrl: settings.getReviewUrl.trim(),
    },
  };
}

export async function repairShopSettingsNulls(): Promise<void> {
  await db.$executeRawUnsafe(`
    UPDATE "ShopSettings"
    SET
      "androidAppVersion" = COALESCE("androidAppVersion", ''),
      "androidPlayStoreUrl" = COALESCE("androidPlayStoreUrl", ''),
      "iosAppVersion" = COALESCE("iosAppVersion", ''),
      "iosAppStoreUrl" = COALESCE("iosAppStoreUrl", ''),
      "backgroundMusicFileUrl" = COALESCE("backgroundMusicFileUrl", ''),
      "backgroundMusicUrl" = COALESCE("backgroundMusicUrl", ''),
      "androidForceUpdateEnabled" = COALESCE("androidForceUpdateEnabled", false),
      "iosForceUpdateEnabled" = COALESCE("iosForceUpdateEnabled", false)
    WHERE
      "androidAppVersion" IS NULL
      OR "androidPlayStoreUrl" IS NULL
      OR "iosAppVersion" IS NULL
      OR "iosAppStoreUrl" IS NULL
      OR "backgroundMusicFileUrl" IS NULL
      OR "backgroundMusicUrl" IS NULL
      OR "androidForceUpdateEnabled" IS NULL
      OR "iosForceUpdateEnabled" IS NULL
  `);

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET
        "productsTabCollection" = COALESCE("productsTabCollection", '{}'::jsonb),
        "coursesTabCollection" = COALESCE("coursesTabCollection", '{}'::jsonb),
        "yagnasTabCollection" = COALESCE("yagnasTabCollection", '{}'::jsonb),
        "yagnasTabProduct" = COALESCE("yagnasTabProduct", '{}'::jsonb)
      WHERE
        "productsTabCollection" IS NULL
        OR "coursesTabCollection" IS NULL
        OR "yagnasTabCollection" IS NULL
        OR "yagnasTabProduct" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET
        "tabBackgroundColor" = COALESCE("tabBackgroundColor", '#ffffff'),
        "bottomTabs" = COALESCE("bottomTabs", '[]'::jsonb)
      WHERE
        "tabBackgroundColor" IS NULL
        OR "bottomTabs" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET "homePageSettings" = COALESCE("homePageSettings", '{}'::jsonb)
      WHERE "homePageSettings" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET "cartSettings" = COALESCE("cartSettings", '{}'::jsonb)
      WHERE "cartSettings" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET "searchSettings" = COALESCE("searchSettings", '{}'::jsonb)
      WHERE "searchSettings" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET "productDetails" = COALESCE("productDetails", '{}'::jsonb)
      WHERE "productDetails" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }
}

export async function getShopSettings(shop: string): Promise<ShopSettingsInput> {
  try {
    await repairShopSettingsNulls();
  } catch (error) {
    console.warn("Failed to repair ShopSettings null values:", error);
  }

  const row = await db.shopSettings.findFirst({ where: { shop } });
  if (!row) {
    return {
      ...DEFAULT_SHOP_SETTINGS,
      productsTabCollection: { ...EMPTY_COLLECTION_REF },
      coursesTabCollection: { ...EMPTY_COLLECTION_REF },
      yagnasTabCollection: { ...EMPTY_COLLECTION_REF },
      yagnasTabProduct: { ...EMPTY_PRODUCT_REF },
      todaysMeditationEntries: [],
      todaysAffirmationEntries: [],
      tabBackgroundColor: "#ffffff",
      bottomTabs: [],
      homePageSettings: {
        ...DEFAULT_HOME_PAGE_SETTINGS,
        topMarquee: { ...DEFAULT_HOME_PAGE_SETTINGS.topMarquee, items: [] },
      },
      cartSettings: {
        ...DEFAULT_CART_SETTINGS,
        cartFreeShippingProgressbar: {
          ...DEFAULT_CART_SETTINGS.cartFreeShippingProgressbar,
        },
        cartHandyItems: {
          ...DEFAULT_CART_SETTINGS.cartHandyItems,
          items: [],
        },
      },
      searchSettings: {
        ...DEFAULT_SEARCH_SETTINGS,
        searchbarCollection: { ...EMPTY_COLLECTION_REF },
      },
      productDetails: { ...DEFAULT_PRODUCT_DETAILS_SETTINGS },
      cacheSettings: parseCacheSettings({}),
      appstleLoyaltyToken: "",
      appstleLoyaltyApiUrl: "",
      trustpilotApiKey: "",
      trustpilotBaseUrl: "",
      writeReviewUrl: "",
      getReviewUrl: "",
    };
  }
  return serializeShopSettings(row);
}

export async function upsertShopSettings(
  shop: string,
  input: ShopSettingsInput,
): Promise<ShopSettingsInput> {
  try {
    await repairShopSettingsNulls();
  } catch (error) {
    console.warn("Failed to repair ShopSettings null values:", error);
  }

  const existing = await db.shopSettings.findFirst({ where: { shop } });

  const row = existing
    ? await db.shopSettings.update({
        where: { id: existing.id },
        data: input as any,
      })
    : await db.shopSettings.create({
        data: {
          shop,
          ...input,
        } as any,
      });

  await invalidateCmsSettingsCache(shop);
  return serializeShopSettings(row);
}

export async function deleteShopSettings(shop: string): Promise<void> {
  await db.shopSettings.deleteMany({ where: { shop } });
  await invalidateCmsSettingsCache(shop);
}
