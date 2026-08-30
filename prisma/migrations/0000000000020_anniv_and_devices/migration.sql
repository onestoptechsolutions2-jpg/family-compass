-- Session device / activity columns
ALTER TABLE "Session" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "ip" TEXT;
ALTER TABLE "Session" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "Session" ADD COLUMN "device" TEXT;

-- Per-tree toggle
ALTER TABLE "Tree" ADD COLUMN "anniversaryReminders" BOOLEAN NOT NULL DEFAULT true;

-- Sent-reminder dedup log
CREATE TABLE "AnniversaryReminder" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "forYear" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnniversaryReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnniversaryReminder_eventId_kind_forYear_key" ON "AnniversaryReminder"("eventId", "kind", "forYear");
CREATE INDEX "AnniversaryReminder_treeId_sentAt_idx" ON "AnniversaryReminder"("treeId", "sentAt");
ALTER TABLE "AnniversaryReminder" ADD CONSTRAINT "AnniversaryReminder_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
