-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SINGLE', 'BUNDLE_5', 'BUNDLE_15', 'KEEPER');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('PURCHASE', 'SPEND', 'GRANT', 'REFUND', 'FREE');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_generationJobId_fkey";

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "exportCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "freeExportUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "freeUnlock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unlockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "creditsGranted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'SINGLE',
ALTER COLUMN "generationJobId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "generationJobId" TEXT,
    "paymentId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLedger_workspaceId_createdAt_idx" ON "CreditLedger"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

