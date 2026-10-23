-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "referralPercent" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "referrerId" TEXT;

-- CreateTable
CREATE TABLE "Referrer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'individual',
    "payoutPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "percent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referrer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderKes" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "amountKes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "payoutRef" TEXT,
    "paidById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_userId_key" ON "Referrer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_code_key" ON "Referrer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_orderId_key" ON "ReferralCommission"("orderId");

-- CreateIndex
CREATE INDEX "ReferralCommission_referrerId_status_idx" ON "ReferralCommission"("referrerId", "status");

-- CreateIndex
CREATE INDEX "ReferralCommission_status_idx" ON "ReferralCommission"("status");

-- CreateIndex
CREATE INDEX "Order_referrerId_idx" ON "Order"("referrerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referrer" ADD CONSTRAINT "Referrer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

