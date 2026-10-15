-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "searchSettings" JSONB NOT NULL DEFAULT '{}';
