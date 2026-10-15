-- CreateTable
CREATE TABLE "PushNotification" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageName" TEXT,
    "imageSize" INTEGER,
    "deeplink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PushNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushNotification_shop_idx" ON "PushNotification"("shop");

-- CreateIndex
CREATE INDEX "PushNotification_shop_createdAt_idx" ON "PushNotification"("shop", "createdAt");