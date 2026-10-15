-- New sends start as "pending" until the push API responds.
ALTER TABLE "PushNotification" ALTER COLUMN "status" SET DEFAULT 'pending';

-- Failure reason from the push API (never contains secrets).
ALTER TABLE "PushNotification" ADD COLUMN "errorMessage" TEXT;

-- Status filter chip counts + filtered history lookups.
CREATE INDEX "PushNotification_shop_status_idx" ON "PushNotification"("shop", "status");
