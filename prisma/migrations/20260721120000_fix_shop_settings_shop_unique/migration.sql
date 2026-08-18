-- Ensure ShopSettings.shop is unique for Prisma upsert/findUnique.
CREATE UNIQUE INDEX IF NOT EXISTS "ShopSettings_shop_key" ON "ShopSettings"("shop");
