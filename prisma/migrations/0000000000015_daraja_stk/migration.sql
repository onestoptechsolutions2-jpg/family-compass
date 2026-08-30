-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING_STK';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkoutRequestId" TEXT,
ADD COLUMN     "merchantRequestId" TEXT,
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "resultCode" INTEGER,
ADD COLUMN     "resultDesc" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutRequestId_key" ON "Payment"("checkoutRequestId");

