CREATE TABLE "LifeUpdate" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "body" TEXT NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "since" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LifeUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LifeUpdate_treeId_createdAt_idx" ON "LifeUpdate"("treeId", "createdAt");
CREATE INDEX "LifeUpdate_personId_current_idx" ON "LifeUpdate"("personId", "current");
ALTER TABLE "LifeUpdate" ADD CONSTRAINT "LifeUpdate_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifeUpdate" ADD CONSTRAINT "LifeUpdate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifeUpdate" ADD CONSTRAINT "LifeUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
