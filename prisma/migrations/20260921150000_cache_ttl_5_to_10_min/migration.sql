-- Keep Redis + Cloudflare/Vercel in the 5–10 minute window; cron stays 5 minutes.
UPDATE "CacheStoreConfig"
SET
  "ttlSeconds" = 600,
  "swrSeconds" = 600,
  "refreshIntervalSeconds" = 300
WHERE "ttlSeconds" < 300 OR "ttlSeconds" > 600
   OR "swrSeconds" < 300 OR "swrSeconds" > 600
   OR "refreshIntervalSeconds" <> 300;
