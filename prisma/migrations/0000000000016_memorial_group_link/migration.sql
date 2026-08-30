-- AlterTable
ALTER TABLE "Memorial" ADD COLUMN     "groupContribToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Memorial_groupContribToken_key" ON "Memorial"("groupContribToken");

