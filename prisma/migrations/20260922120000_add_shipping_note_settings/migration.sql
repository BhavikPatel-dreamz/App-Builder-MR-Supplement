-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "shippingNote" TEXT NOT NULL DEFAULT '';
