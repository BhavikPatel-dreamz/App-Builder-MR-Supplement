-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "cartSettings" JSONB NOT NULL DEFAULT '{}';
