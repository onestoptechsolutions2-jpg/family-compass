CREATE TABLE "ViewEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "treeId" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "region" TEXT,
    "lang" TEXT,
    "referrerHost" TEXT,
    "deviceKind" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ViewEvent_kind_targetId_createdAt_idx" ON "ViewEvent"("kind", "targetId", "createdAt");
CREATE INDEX "ViewEvent_treeId_createdAt_idx" ON "ViewEvent"("treeId", "createdAt");
