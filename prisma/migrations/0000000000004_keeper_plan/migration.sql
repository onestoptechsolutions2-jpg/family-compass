-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "keeperUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "treeId" TEXT;

-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "keeperPriceKes" INTEGER NOT NULL DEFAULT 3000;

-- CreateIndex
CREATE INDEX "Payment_treeId_idx" ON "Payment"("treeId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

