-- CreateEnum
CREATE TYPE "IdentityRelationshipKind" AS ENUM ('BLOOD_ECHO', 'MARRIAGE', 'CHOSEN');

-- CreateEnum
CREATE TYPE "IdentityRelationshipStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "IdentityMergeStatus" AS ENUM ('PROPOSED', 'CORROBORATING', 'EXECUTED', 'REVERTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "claimedByUserId" TEXT,
    "displayName" TEXT,
    "birthYearHint" INTEGER,
    "genderHint" "Gender",
    "mergedIntoId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityRelationship" (
    "id" TEXT NOT NULL,
    "aIdentityId" TEXT NOT NULL,
    "bIdentityId" TEXT NOT NULL,
    "kind" "IdentityRelationshipKind" NOT NULL,
    "status" "IdentityRelationshipStatus" NOT NULL DEFAULT 'PROPOSED',
    "sourceTreeId" TEXT,
    "sourceFamilyId" TEXT,
    "assertedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityMergeRequest" (
    "id" TEXT NOT NULL,
    "fromIdentityId" TEXT NOT NULL,
    "intoIdentityId" TEXT NOT NULL,
    "status" "IdentityMergeStatus" NOT NULL DEFAULT 'PROPOSED',
    "evidence" TEXT,
    "proposedById" TEXT NOT NULL,
    "snapshot" JSONB,
    "executedAt" TIMESTAMP(3),
    "revertibleUntil" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityMergeRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Person" ADD COLUMN "identityId" TEXT;

-- AlterTable
ALTER TABLE "PersonClaim" ADD COLUMN "targetIdentityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Identity_claimedByUserId_key" ON "Identity"("claimedByUserId");

-- CreateIndex
CREATE INDEX "Identity_mergedIntoId_idx" ON "Identity"("mergedIntoId");

-- CreateIndex
CREATE INDEX "IdentityRelationship_aIdentityId_idx" ON "IdentityRelationship"("aIdentityId");

-- CreateIndex
CREATE INDEX "IdentityRelationship_bIdentityId_idx" ON "IdentityRelationship"("bIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityRelationship_aIdentityId_bIdentityId_kind_key" ON "IdentityRelationship"("aIdentityId", "bIdentityId", "kind");

-- CreateIndex
CREATE INDEX "IdentityMergeRequest_fromIdentityId_idx" ON "IdentityMergeRequest"("fromIdentityId");

-- CreateIndex
CREATE INDEX "IdentityMergeRequest_intoIdentityId_idx" ON "IdentityMergeRequest"("intoIdentityId");

-- CreateIndex
CREATE INDEX "IdentityMergeRequest_status_idx" ON "IdentityMergeRequest"("status");

-- CreateIndex
CREATE INDEX "Person_identityId_idx" ON "Person"("identityId");

-- CreateIndex
CREATE INDEX "PersonClaim_targetIdentityId_idx" ON "PersonClaim"("targetIdentityId");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityRelationship" ADD CONSTRAINT "IdentityRelationship_aIdentityId_fkey" FOREIGN KEY ("aIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityRelationship" ADD CONSTRAINT "IdentityRelationship_bIdentityId_fkey" FOREIGN KEY ("bIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityRelationship" ADD CONSTRAINT "IdentityRelationship_assertedById_fkey" FOREIGN KEY ("assertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMergeRequest" ADD CONSTRAINT "IdentityMergeRequest_fromIdentityId_fkey" FOREIGN KEY ("fromIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMergeRequest" ADD CONSTRAINT "IdentityMergeRequest_intoIdentityId_fkey" FOREIGN KEY ("intoIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMergeRequest" ADD CONSTRAINT "IdentityMergeRequest_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_targetIdentityId_fkey" FOREIGN KEY ("targetIdentityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
