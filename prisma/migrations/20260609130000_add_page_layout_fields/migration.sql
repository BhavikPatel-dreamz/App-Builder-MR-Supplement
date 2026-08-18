-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'page',
ADD COLUMN     "hideHeader" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPageTitle" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
ADD COLUMN     "renderingType" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "headerId" TEXT,
ADD COLUMN     "footerId" TEXT;

-- CreateIndex
CREATE INDEX "Page_shop_type_idx" ON "Page"("shop", "type");
