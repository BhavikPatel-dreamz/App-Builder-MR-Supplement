-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "androidAppVersion" TEXT NOT NULL DEFAULT '',
    "androidPlayStoreUrl" TEXT NOT NULL DEFAULT '',
    "androidForceUpdateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "iosAppVersion" TEXT NOT NULL DEFAULT '',
    "iosAppStoreUrl" TEXT NOT NULL DEFAULT '',
    "iosForceUpdateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backgroundMusicFileUrl" TEXT NOT NULL DEFAULT '',
    "backgroundMusicUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");
