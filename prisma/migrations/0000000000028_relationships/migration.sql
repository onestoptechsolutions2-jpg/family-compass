-- Relationships as shared history: Memory / MemoryParticipant / RelationEdge / RelationAssertion

CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dateText" TEXT,
    "dateSortKey" TEXT,
    "placeId" TEXT,
    "eventId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Memory_treeId_idx" ON "Memory"("treeId");
CREATE INDEX "Memory_dateSortKey_idx" ON "Memory"("dateSortKey");
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MemoryParticipant" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemoryParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemoryParticipant_memoryId_personId_key" ON "MemoryParticipant"("memoryId", "personId");
CREATE INDEX "MemoryParticipant_personId_idx" ON "MemoryParticipant"("personId");
ALTER TABLE "MemoryParticipant" ADD CONSTRAINT "MemoryParticipant_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryParticipant" ADD CONSTRAINT "MemoryParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RelationEdge" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "aPersonId" TEXT NOT NULL,
    "bPersonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CHOSEN',
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seededById" TEXT,
    "originText" TEXT,
    "originContext" TEXT,
    "originViaPersonId" TEXT,
    "originAt" TEXT,
    "firstMemoryAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RelationEdge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelationEdge_aPersonId_bPersonId_key" ON "RelationEdge"("aPersonId", "bPersonId");
CREATE INDEX "RelationEdge_treeId_idx" ON "RelationEdge"("treeId");
CREATE INDEX "RelationEdge_bPersonId_idx" ON "RelationEdge"("bPersonId");
ALTER TABLE "RelationEdge" ADD CONSTRAINT "RelationEdge_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationEdge" ADD CONSTRAINT "RelationEdge_aPersonId_fkey" FOREIGN KEY ("aPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationEdge" ADD CONSTRAINT "RelationEdge_bPersonId_fkey" FOREIGN KEY ("bPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationEdge" ADD CONSTRAINT "RelationEdge_seededById_fkey" FOREIGN KEY ("seededById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RelationEdge_originViaPersonId_idx" ON "RelationEdge"("originViaPersonId");
ALTER TABLE "RelationEdge" ADD CONSTRAINT "RelationEdge_originViaPersonId_fkey" FOREIGN KEY ("originViaPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RelationAssertion" (
    "id" TEXT NOT NULL,
    "edgeId" TEXT NOT NULL,
    "byPersonId" TEXT NOT NULL,
    "role" TEXT,
    "strengthHint" INTEGER,
    "assertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelationAssertion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelationAssertion_edgeId_byPersonId_key" ON "RelationAssertion"("edgeId", "byPersonId");
ALTER TABLE "RelationAssertion" ADD CONSTRAINT "RelationAssertion_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "RelationEdge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationAssertion" ADD CONSTRAINT "RelationAssertion_byPersonId_fkey" FOREIGN KEY ("byPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaRef" ADD COLUMN "memoryId" TEXT;
CREATE INDEX "MediaRef_memoryId_idx" ON "MediaRef"("memoryId");
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
