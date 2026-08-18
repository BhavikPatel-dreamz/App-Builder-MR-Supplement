-- Today's Meditation schedule settings (default image + dated entries).
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "todaysMeditationDefaultImageUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "todaysMeditationEntries" JSONB NOT NULL DEFAULT '[]';
