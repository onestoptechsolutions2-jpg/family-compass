-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receivedKes" INTEGER,
ADD COLUMN     "refundNote" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedKes" INTEGER NOT NULL DEFAULT 0;

