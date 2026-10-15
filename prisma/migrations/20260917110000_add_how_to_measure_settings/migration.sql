-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "howToMeasure" JSONB NOT NULL DEFAULT '{}';
