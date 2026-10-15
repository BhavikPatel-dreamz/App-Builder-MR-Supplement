-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "tabBackgroundColor" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "ShopSettings" ADD COLUMN "bottomTabs" JSONB NOT NULL DEFAULT '[]';
