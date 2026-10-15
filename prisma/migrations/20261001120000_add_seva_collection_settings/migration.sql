-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "sevaCollection" JSONB NOT NULL DEFAULT '{}';
