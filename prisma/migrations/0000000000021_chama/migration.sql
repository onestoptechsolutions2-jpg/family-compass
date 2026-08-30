-- Enums
CREATE TYPE "ChamaPurpose" AS ENUM ('WELFARE', 'SAVINGS', 'MERRY_GO_ROUND', 'TABLE_BANKING');
CREATE TYPE "ChamaRole" AS ENUM ('ADMIN', 'TREASURER', 'MEMBER');
CREATE TYPE "ChamaFundStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ChamaContribMethod" AS ENUM ('MPESA_STK', 'MPESA_MANUAL', 'CASH', 'OTHER');
CREATE TYPE "ChamaContribStatus" AS ENUM ('PLEDGED', 'CONFIRMED', 'VOID');

ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'CHAMA_CONTRIBUTION';

-- Chama
CREATE TABLE "Chama" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "ChamaPurpose" NOT NULL DEFAULT 'WELFARE',
    "defaultAmountKes" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Chama_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Chama_treeId_idx" ON "Chama"("treeId");
CREATE INDEX "Chama_workspaceId_idx" ON "Chama"("workspaceId");
ALTER TABLE "Chama" ADD CONSTRAINT "Chama_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chama" ADD CONSTRAINT "Chama_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chama" ADD CONSTRAINT "Chama_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChamaMember
CREATE TABLE "ChamaMember" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "personId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "ChamaRole" NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChamaMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChamaMember_chamaId_personId_key" ON "ChamaMember"("chamaId", "personId");
CREATE INDEX "ChamaMember_chamaId_idx" ON "ChamaMember"("chamaId");
ALTER TABLE "ChamaMember" ADD CONSTRAINT "ChamaMember_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "Chama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamaMember" ADD CONSTRAINT "ChamaMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChamaFund
CREATE TABLE "ChamaFund" (
    "id" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "purposeNote" TEXT,
    "targetKes" INTEGER,
    "memorialId" TEXT,
    "publicToken" TEXT NOT NULL,
    "status" "ChamaFundStatus" NOT NULL DEFAULT 'OPEN',
    "opensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChamaFund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChamaFund_memorialId_key" ON "ChamaFund"("memorialId");
CREATE UNIQUE INDEX "ChamaFund_publicToken_key" ON "ChamaFund"("publicToken");
CREATE INDEX "ChamaFund_chamaId_status_idx" ON "ChamaFund"("chamaId", "status");
ALTER TABLE "ChamaFund" ADD CONSTRAINT "ChamaFund_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "Chama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamaFund" ADD CONSTRAINT "ChamaFund_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChamaContribution
CREATE TABLE "ChamaContribution" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "chamaId" TEXT NOT NULL,
    "memberId" TEXT,
    "contributorName" TEXT NOT NULL,
    "phone" TEXT,
    "amountKes" INTEGER NOT NULL,
    "method" "ChamaContribMethod" NOT NULL DEFAULT 'MPESA_MANUAL',
    "status" "ChamaContribStatus" NOT NULL DEFAULT 'PLEDGED',
    "paymentId" TEXT,
    "mpesaCode" TEXT,
    "note" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    CONSTRAINT "ChamaContribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChamaContribution_paymentId_key" ON "ChamaContribution"("paymentId");
CREATE INDEX "ChamaContribution_fundId_status_idx" ON "ChamaContribution"("fundId", "status");
CREATE INDEX "ChamaContribution_chamaId_createdAt_idx" ON "ChamaContribution"("chamaId", "createdAt");
CREATE INDEX "ChamaContribution_mpesaCode_idx" ON "ChamaContribution"("mpesaCode");
ALTER TABLE "ChamaContribution" ADD CONSTRAINT "ChamaContribution_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "ChamaFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamaContribution" ADD CONSTRAINT "ChamaContribution_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "Chama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamaContribution" ADD CONSTRAINT "ChamaContribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ChamaMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChamaContribution" ADD CONSTRAINT "ChamaContribution_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChamaContribution" ADD CONSTRAINT "ChamaContribution_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
