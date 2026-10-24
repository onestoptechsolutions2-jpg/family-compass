-- AlterTable
ALTER TABLE "ChamaFund" ADD COLUMN     "branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "convertedGroupId" INTEGER,
ADD COLUMN     "partnerByBranch" JSONB,
ADD COLUMN     "partnerFundId" INTEGER,
ADD COLUMN     "partnerGiftCount" INTEGER,
ADD COLUMN     "partnerGiveUrl" TEXT,
ADD COLUMN     "partnerSecret" TEXT,
ADD COLUMN     "partnerStatus" TEXT,
ADD COLUMN     "partnerSyncedAt" TIMESTAMP(3),
ADD COLUMN     "partnerTotalKes" INTEGER;

-- AlterTable
ALTER TABLE "Referrer" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "payout" JSONB,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "payoutPhone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PartnerEvent" (
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'chama',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChamaFund_partnerFundId_key" ON "ChamaFund"("partnerFundId");

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_externalRef_key" ON "Referrer"("externalRef");

