ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'MEMORIAL_PASS';

ALTER TABLE "PaymentSettings" ADD COLUMN "memorialPassKes" INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE "PaymentSettings" ADD COLUMN "memorialPassDays" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "Memorial" ADD COLUMN "passUntil" TIMESTAMP(3);

ALTER TABLE "Payment" ADD COLUMN "memorialId" TEXT;
CREATE INDEX "Payment_memorialId_idx" ON "Payment"("memorialId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
