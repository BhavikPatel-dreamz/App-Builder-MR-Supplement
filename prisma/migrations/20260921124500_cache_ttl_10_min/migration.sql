-- Align existing cache rows with 10-minute CDN TTL and 5-minute refresh.
UPDATE "CacheStoreConfig"
SET
  "ttlSeconds" = 600,
  "swrSeconds" = 600,
  "refreshIntervalSeconds" = 300
WHERE "ttlSeconds" > 600;
