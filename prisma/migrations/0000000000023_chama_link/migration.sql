CREATE TABLE "ChamaLink" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://chama.laitor.co.ke',
    "apiKey" TEXT NOT NULL,
    "groupId" INTEGER,
    "groupName" TEXT,
    "groupType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "webhookSecret" TEXT,
    "pushWelfare" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChamaLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChamaLink_treeId_key" ON "ChamaLink"("treeId");
ALTER TABLE "ChamaLink" ADD CONSTRAINT "ChamaLink_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
