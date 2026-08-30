-- CreateTable
CREATE TABLE "ClaimInvite" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "claimId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaimInvite_token_key" ON "ClaimInvite"("token");

-- CreateIndex
CREATE INDEX "ClaimInvite_treeId_idx" ON "ClaimInvite"("treeId");

-- CreateIndex
CREATE INDEX "ClaimInvite_personId_idx" ON "ClaimInvite"("personId");

-- AddForeignKey
ALTER TABLE "ClaimInvite" ADD CONSTRAINT "ClaimInvite_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimInvite" ADD CONSTRAINT "ClaimInvite_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimInvite" ADD CONSTRAINT "ClaimInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

