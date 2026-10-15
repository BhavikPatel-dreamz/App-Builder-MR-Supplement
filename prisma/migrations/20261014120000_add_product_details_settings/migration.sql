-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "productDetails" JSONB NOT NULL DEFAULT '{}';
