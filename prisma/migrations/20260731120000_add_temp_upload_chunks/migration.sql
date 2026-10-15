-- CreateTable
CREATE TABLE "TempUploadChunk" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempUploadChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TempUploadChunk_uploadId_idx" ON "TempUploadChunk"("uploadId");

-- CreateIndex
CREATE INDEX "TempUploadChunk_shop_createdAt_idx" ON "TempUploadChunk"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TempUploadChunk_uploadId_chunkIndex_key" ON "TempUploadChunk"("uploadId", "chunkIndex");
