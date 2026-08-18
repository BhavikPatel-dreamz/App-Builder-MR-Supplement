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
  normalizeTodaysMeditationEntries,
  parseTodaysMeditationEntries,
  resolveTodaysMeditation,
  splitMeditationEntriesByDate,
  todayDateKey,
  toPublicMeditationEntry,
  type PublicMeditationEntry,
  type TodaysMeditationEntry,
} from "./todays-meditation";
import {
  normalizeTodaysAffirmationEntries,
  parseTodaysAffirmationEntries,
  resolveTodaysAffirmation,
  splitAffirmationEntriesByDate,
  toPublicAffirmationEntry,
  type PublicAffirmationEntry,
  type TodaysAffirmationEntry,
} from "./todays-affirmation";

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
  todaysMeditationEntries: TodaysMeditationEntry[];
  todaysAffirmationDefaultImageUrl: string;
  todaysAffirmationEntries: TodaysAffirmationEntry[];
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
    todaysMeditationEntries: normalizeTodaysMeditationEntries(
      row.todaysMeditationEntries,
    ),
    todaysAffirmationDefaultImageUrl: row.todaysAffirmationDefaultImageUrl || "",
    todaysAffirmationEntries: normalizeTodaysAffirmationEntries(
      row.todaysAffirmationEntries,
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
    entries: PublicMeditationEntry[];
    past: PublicMeditationEntry[];
    upcoming: PublicMeditationEntry[];
    today: PublicMeditationEntry | null;
  };
  todaysAffirmation: {
    defaultImageUrl: string | null;
    todayDate: string;
    entries: PublicAffirmationEntry[];
    past: PublicAffirmationEntry[];
    upcoming: PublicAffirmationEntry[];
    today: PublicAffirmationEntry | null;
  };
};

export function buildTodaysMeditationPublicPayload(
  settings: Pick<
    ShopSettingsInput,
    "todaysMeditationDefaultImageUrl" | "todaysMeditationEntries"
  >,
) {
  const defaultImage = settings.todaysMeditationDefaultImageUrl.trim();
  const publishableEntries = parseTodaysMeditationEntries(
    settings.todaysMeditationEntries,
  );
  const today = todayDateKey();
  const { past, upcoming } = splitMeditationEntriesByDate(
    publishableEntries,
    today,
  );
  const resolvedToday = resolveTodaysMeditation({
    entries: publishableEntries,
    defaultImageUrl: defaultImage,
    date: today,
  });

  return {
    defaultImageUrl: defaultImage || null,
    todayDate: today,
    entries: publishableEntries.map((entry) =>
      toPublicMeditationEntry(entry, defaultImage),
    ),
    past: past.map((entry) => toPublicMeditationEntry(entry, defaultImage)),
    upcoming: upcoming.map((entry) =>
      toPublicMeditationEntry(entry, defaultImage),
    ),
    today: resolvedToday
      ? {
          id: resolvedToday.id,
          date: resolvedToday.date,
          audioUrl: resolvedToday.audioUrl,
          imageUrl: resolvedToday.usedDefaultImage
            ? null
            : resolvedToday.imageUrl || null,
          resolvedImageUrl: resolvedToday.imageUrl || null,
          usedDefaultImage: resolvedToday.usedDefaultImage,
        }
      : null,
  };
}

export function buildTodaysAffirmationPublicPayload(
  settings: Pick<
    ShopSettingsInput,
    "todaysAffirmationDefaultImageUrl" | "todaysAffirmationEntries"
  >,
) {
  const defaultImage = settings.todaysAffirmationDefaultImageUrl.trim();
  const publishableEntries = parseTodaysAffirmationEntries(
    settings.todaysAffirmationEntries,
  );
  const today = todayDateKey();
  const { past, upcoming } = splitAffirmationEntriesByDate(
    publishableEntries,
    today,
  );
  const resolvedToday = resolveTodaysAffirmation({
    entries: publishableEntries,
    defaultImageUrl: defaultImage,
    date: today,
  });

  return {
    defaultImageUrl: defaultImage || null,
    todayDate: today,
    entries: publishableEntries.map((entry) =>
      toPublicAffirmationEntry(entry, defaultImage),
    ),
    past: past.map((entry) => toPublicAffirmationEntry(entry, defaultImage)),
    upcoming: upcoming.map((entry) =>
      toPublicAffirmationEntry(entry, defaultImage),
    ),
    today: resolvedToday
      ? {
          id: resolvedToday.id,
          date: resolvedToday.date,
          imageUrl: resolvedToday.usedDefaultImage
            ? null
            : resolvedToday.imageUrl || null,
          resolvedImageUrl: resolvedToday.imageUrl || null,
          usedDefaultImage: resolvedToday.usedDefaultImage,
        }
      : null,
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
  };
}

export async function repairShopSettingsNulls(): Promise<void> {
  // Some older rows/columns can contain SQL NULL even though Prisma schema
  // expects non-null strings/bools/json. Normalize before Prisma reads.
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

  // Newer columns may not exist until migrate deploy; ignore failures here.
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
        "todaysMeditationDefaultImageUrl" = COALESCE("todaysMeditationDefaultImageUrl", ''),
        "todaysMeditationEntries" = COALESCE("todaysMeditationEntries", '[]'::jsonb)
      WHERE
        "todaysMeditationDefaultImageUrl" IS NULL
        OR "todaysMeditationEntries" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }

  try {
    await db.$executeRawUnsafe(`
      UPDATE "ShopSettings"
      SET
        "todaysAffirmationDefaultImageUrl" = COALESCE("todaysAffirmationDefaultImageUrl", ''),
        "todaysAffirmationEntries" = COALESCE("todaysAffirmationEntries", '[]'::jsonb)
      WHERE
        "todaysAffirmationDefaultImageUrl" IS NULL
        OR "todaysAffirmationEntries" IS NULL
    `);
  } catch {
    // Column not migrated yet.
  }
}

export async function getShopSettings(shop: string): Promise<ShopSettingsInput> {
  try {
    await repairShopSettingsNulls();
  } catch (error) {
    // Columns from newer migrations may not exist yet; continue and let
    // Prisma surface a clearer error if the read still fails.
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
        data: input,
      })
    : await db.shopSettings.create({
        data: {
          shop,
          ...input,
        },
      });

  return serializeShopSettings(row);
}

export async function deleteShopSettings(shop: string): Promise<void> {
  await db.shopSettings.deleteMany({ where: { shop } });
}
