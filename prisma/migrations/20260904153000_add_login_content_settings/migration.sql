-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "loginHtmlContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ShopSettings" ADD COLUMN "loginBackgroundColor" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "ShopSettings" ADD COLUMN "loginLogoUrl" TEXT NOT NULL DEFAULT '';
