-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "cacheSettings" JSONB NOT NULL DEFAULT '{}';
