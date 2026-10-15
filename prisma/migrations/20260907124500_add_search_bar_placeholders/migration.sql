-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "searchBarPlaceHoldersText" JSONB NOT NULL DEFAULT '["Parka Jackets", "Boxers", "Vests"]';
