-- CreateEnum
CREATE TYPE "MemorialStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'FINAL');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Memorial" ADD COLUMN     "finalisedAt" TIMESTAMP(3),
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT,
ADD COLUMN     "status" "MemorialStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "MemorialContributor" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "relation" TEXT,
    "token" TEXT NOT NULL,
    "invitedById" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorialContribution" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "contributorId" TEXT,
    "authorName" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemorialContributor_token_key" ON "MemorialContributor"("token");

-- CreateIndex
CREATE INDEX "MemorialContributor_memorialId_idx" ON "MemorialContributor"("memorialId");

-- CreateIndex
CREATE INDEX "MemorialContribution_memorialId_status_idx" ON "MemorialContribution"("memorialId", "status");

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialContributor" ADD CONSTRAINT "MemorialContributor_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialContributor" ADD CONSTRAINT "MemorialContributor_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialContribution" ADD CONSTRAINT "MemorialContribution_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialContribution" ADD CONSTRAINT "MemorialContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "MemorialContributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialContribution" ADD CONSTRAINT "MemorialContribution_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

