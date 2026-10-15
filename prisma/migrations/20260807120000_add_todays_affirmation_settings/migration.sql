-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "todaysAffirmationDefaultImageUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "todaysAffirmationEntries" JSONB NOT NULL DEFAULT '[]';
