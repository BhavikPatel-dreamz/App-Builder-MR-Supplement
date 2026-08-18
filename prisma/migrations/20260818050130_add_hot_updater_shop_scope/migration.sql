/*
  Warnings:

  - You are about to drop the `TempUploadChunk` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "TempUploadChunk";

-- CreateTable
CREATE TABLE "Bundles" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "should_force_update" BOOLEAN NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "file_hash" TEXT NOT NULL,
    "git_commit_hash" TEXT,
    "message" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'production',
    "storage_uri" TEXT NOT NULL,
    "target_app_version" TEXT,
    "fingerprint_hash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "rollout_cohort_count" INTEGER NOT NULL DEFAULT 1000,
    "target_cohorts" JSONB,
    "manifest_storage_uri" TEXT,
    "manifest_file_hash" TEXT,
    "asset_base_storage_uri" TEXT,

    CONSTRAINT "Bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle_patches" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "base_bundle_id" TEXT NOT NULL,
    "base_file_hash" TEXT NOT NULL,
    "patch_file_hash" TEXT NOT NULL,
    "patch_storage_uri" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Bundle_patches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bundles_shop_idx" ON "Bundles"("shop");

-- CreateIndex
CREATE INDEX "Bundles_target_app_version_idx" ON "Bundles"("target_app_version");

-- CreateIndex
CREATE INDEX "Bundles_fingerprint_hash_idx" ON "Bundles"("fingerprint_hash");

-- CreateIndex
CREATE INDEX "Bundles_channel_idx" ON "Bundles"("channel");

-- CreateIndex
CREATE INDEX "Bundles_rollout_cohort_count_idx" ON "Bundles"("rollout_cohort_count");

-- CreateIndex
CREATE UNIQUE INDEX "Bundles_shop_id_key" ON "Bundles"("shop", "id");

-- CreateIndex
CREATE INDEX "Bundle_patches_shop_idx" ON "Bundle_patches"("shop");

-- CreateIndex
CREATE INDEX "Bundle_patches_bundle_id_idx" ON "Bundle_patches"("bundle_id");

-- CreateIndex
CREATE INDEX "Bundle_patches_base_bundle_id_idx" ON "Bundle_patches"("base_bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_patches_shop_id_key" ON "Bundle_patches"("shop", "id");

-- AddForeignKey
ALTER TABLE "Bundles" ADD CONSTRAINT "Bundles_shop_fkey" FOREIGN KEY ("shop") REFERENCES "ShopSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle_patches" ADD CONSTRAINT "Bundle_patches_shop_bundle_id_fkey" FOREIGN KEY ("shop", "bundle_id") REFERENCES "Bundles"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle_patches" ADD CONSTRAINT "Bundle_patches_shop_base_bundle_id_fkey" FOREIGN KEY ("shop", "base_bundle_id") REFERENCES "Bundles"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle_patches" ADD CONSTRAINT "Bundle_patches_shop_fkey" FOREIGN KEY ("shop") REFERENCES "ShopSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;
