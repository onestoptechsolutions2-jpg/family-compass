-- DropIndex
DROP INDEX "Payment_memorialId_idx";

-- DropIndex
DROP INDEX "Person_namedAfterId_idx";

-- DropIndex
DROP INDEX "RelationEdge_originViaPersonId_idx";

-- DropIndex
DROP INDEX "Tree_adminUserId_idx";

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "keeperAutoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keeperReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "keeperRenewalAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keeperRenewalPhone" TEXT;
