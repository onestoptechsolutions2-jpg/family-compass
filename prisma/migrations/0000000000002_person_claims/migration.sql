-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "claimPinHash" TEXT,
ADD COLUMN     "contactWhatsapp" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "claimedByUserId" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "SharedView" ADD COLUMN     "allowClaims" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PersonClaim" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "personId" TEXT,
    "claimantName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "code" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "signInToken" TEXT,
    "signInTokenExpiresAt" TIMESTAMP(3),
    "signInTokenUsedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonClaim_signInToken_key" ON "PersonClaim"("signInToken");

-- CreateIndex
CREATE INDEX "PersonClaim_treeId_status_idx" ON "PersonClaim"("treeId", "status");

-- CreateIndex
CREATE INDEX "PersonClaim_code_idx" ON "PersonClaim"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Person_claimedByUserId_key" ON "Person"("claimedByUserId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

