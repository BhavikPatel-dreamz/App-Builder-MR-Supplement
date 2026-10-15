-- CreateTable
CREATE TABLE IF NOT EXISTS "CacheStoreConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "redisEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cdnEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttlSeconds" INTEGER NOT NULL DEFAULT 1800,
    "swrSeconds" INTEGER NOT NULL DEFAULT 1800,
    "warmerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "refreshIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CacheStoreConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CacheUrl" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "sha256" TEXT NOT NULL DEFAULT '',
    "variablesJson" TEXT NOT NULL DEFAULT '{}',
    "slug" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "lastWarmedAt" TIMESTAMP(3),
    "lastClearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CacheUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CacheLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "urlId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CacheLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CacheStoreConfig_shop_key" ON "CacheStoreConfig"("shop");
CREATE INDEX IF NOT EXISTS "CacheUrl_shop_idx" ON "CacheUrl"("shop");
CREATE INDEX IF NOT EXISTS "CacheUrl_shop_enabled_idx" ON "CacheUrl"("shop", "enabled");
CREATE INDEX IF NOT EXISTS "CacheLog_shop_createdAt_idx" ON "CacheLog"("shop", "createdAt");

ALTER TABLE "CacheUrl" ADD CONSTRAINT "CacheUrl_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CacheStoreConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CacheLog" ADD CONSTRAINT "CacheLog_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CacheStoreConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CacheLog" ADD CONSTRAINT "CacheLog_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "CacheUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
