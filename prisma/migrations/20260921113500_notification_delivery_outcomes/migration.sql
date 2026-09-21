-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'delivered',
ADD COLUMN "deliveryReason" TEXT,
ADD COLUMN "channelOutcomes" JSONB DEFAULT '{}'::jsonb;
