-- GuestbookReply
CREATE TABLE "GuestbookReply" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "GuestbookStatus" NOT NULL DEFAULT 'PENDING',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestbookReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestbookReply_entryId_status_idx" ON "GuestbookReply"("entryId", "status");
ALTER TABLE "GuestbookReply" ADD CONSTRAINT "GuestbookReply_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GuestbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TributeReaction
CREATE TABLE "TributeReaction" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "name" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TributeReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TributeReaction_entryId_ip_emoji_key" ON "TributeReaction"("entryId", "ip", "emoji");
CREATE INDEX "TributeReaction_entryId_idx" ON "TributeReaction"("entryId");
ALTER TABLE "TributeReaction" ADD CONSTRAINT "TributeReaction_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GuestbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
