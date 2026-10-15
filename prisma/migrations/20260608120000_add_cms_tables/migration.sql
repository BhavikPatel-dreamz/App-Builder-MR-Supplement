-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyFileId" TEXT,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "title" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Page_shop_idx" ON "Page"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Page_shop_slug_key" ON "Page"("shop", "slug");

-- CreateIndex
CREATE INDEX "Media_shop_idx" ON "Media"("shop");
