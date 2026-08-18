-- Repair nullable/legacy null values in ShopSettings so Prisma non-null String
-- fields can deserialize safely.
UPDATE "ShopSettings"
SET
  "androidAppVersion" = COALESCE("androidAppVersion", ''),
  "androidPlayStoreUrl" = COALESCE("androidPlayStoreUrl", ''),
  "iosAppVersion" = COALESCE("iosAppVersion", ''),
  "iosAppStoreUrl" = COALESCE("iosAppStoreUrl", ''),
  "backgroundMusicFileUrl" = COALESCE("backgroundMusicFileUrl", ''),
  "backgroundMusicUrl" = COALESCE("backgroundMusicUrl", ''),
  "todaysMeditationDefaultImageUrl" = COALESCE("todaysMeditationDefaultImageUrl", ''),
  "androidForceUpdateEnabled" = COALESCE("androidForceUpdateEnabled", false),
  "iosForceUpdateEnabled" = COALESCE("iosForceUpdateEnabled", false),
  "productsTabCollection" = COALESCE("productsTabCollection", '{}'::jsonb),
  "coursesTabCollection" = COALESCE("coursesTabCollection", '{}'::jsonb),
  "yagnasTabCollection" = COALESCE("yagnasTabCollection", '{}'::jsonb),
  "yagnasTabProduct" = COALESCE("yagnasTabProduct", '{}'::jsonb),
  "todaysMeditationEntries" = COALESCE("todaysMeditationEntries", '[]'::jsonb);

ALTER TABLE "ShopSettings" ALTER COLUMN "androidAppVersion" SET DEFAULT '';
ALTER TABLE "ShopSettings" ALTER COLUMN "androidAppVersion" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "androidPlayStoreUrl" SET DEFAULT '';
ALTER TABLE "ShopSettings" ALTER COLUMN "androidPlayStoreUrl" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "iosAppVersion" SET DEFAULT '';
ALTER TABLE "ShopSettings" ALTER COLUMN "iosAppVersion" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "iosAppStoreUrl" SET DEFAULT '';
ALTER TABLE "ShopSettings" ALTER COLUMN "iosAppStoreUrl" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "backgroundMusicFileUrl" SET DEFAULT '';
ALTER TABLE "ShopSettings" ALTER COLUMN "backgroundMusicFileUrl" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "backgroundMusicUrl" SET DEFAULT '';
ALTER TABLE "ShopSettings" ALTER COLUMN "backgroundMusicUrl" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "androidForceUpdateEnabled" SET DEFAULT false;
ALTER TABLE "ShopSettings" ALTER COLUMN "androidForceUpdateEnabled" SET NOT NULL;
ALTER TABLE "ShopSettings" ALTER COLUMN "iosForceUpdateEnabled" SET DEFAULT false;
ALTER TABLE "ShopSettings" ALTER COLUMN "iosForceUpdateEnabled" SET NOT NULL;
