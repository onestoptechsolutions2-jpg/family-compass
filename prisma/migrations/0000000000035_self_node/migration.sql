CREATE TABLE "SelfNode" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "familyMeans" TEXT,
    "belonging" TEXT,
    "strongestTie" TEXT,
    "forDescendant" TEXT,
    "familyFeeling" INTEGER,
    "familyFeelingWord" TEXT,
    "gaveAndCost" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SelfNode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SelfNode_personId_key" ON "SelfNode"("personId");
ALTER TABLE "SelfNode" ADD CONSTRAINT "SelfNode_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
