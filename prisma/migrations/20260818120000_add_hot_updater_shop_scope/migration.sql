-- AlterTable: Add shop column to bundles
ALTER TABLE "bundles" ADD COLUMN "shop" TEXT NOT NULL DEFAULT '';

-- AlterTable: Add shop column to bundle_patches
ALTER TABLE "bundle_patches" ADD COLUMN "shop" TEXT NOT NULL DEFAULT '';

-- CreateIndex: bundles shop
CREATE UNIQUE INDEX "bundles_shop_id_key" ON "bundles"("shop", "id");

-- CreateIndex: bundles shop index
CREATE INDEX "bundles_shop_idx" ON "bundles"("shop");

-- CreateIndex: bundle_patches shop
CREATE UNIQUE INDEX "bundle_patches_shop_id_key" ON "bundle_patches"("shop", "id");

-- CreateIndex: bundle_patches shop index
CREATE INDEX "bundle_patches_shop_idx" ON "bundle_patches"("shop");

-- AddForeignKey
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_shop_fkey" FOREIGN KEY ("shop") REFERENCES "ShopSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_patches" ADD CONSTRAINT "bundle_patches_shop_bundle_id_fkey" FOREIGN KEY ("shop", "bundle_id") REFERENCES "bundles"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_patches" ADD CONSTRAINT "bundle_patches_shop_base_bundle_id_fkey" FOREIGN KEY ("shop", "base_bundle_id") REFERENCES "bundles"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_patches" ADD CONSTRAINT "bundle_patches_shop_fkey" FOREIGN KEY ("shop") REFERENCES "ShopSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;
