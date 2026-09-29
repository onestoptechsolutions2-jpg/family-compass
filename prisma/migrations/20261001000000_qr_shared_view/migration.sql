-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "sharedViewId" TEXT;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_sharedViewId_fkey" FOREIGN KEY ("sharedViewId") REFERENCES "SharedView"("id") ON DELETE SET NULL ON UPDATE CASCADE;

