-- CreateTable
CREATE TABLE "MemorialFlower" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'flower',
    "name" TEXT,
    "ip" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialFlower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemorialFlower_memorialId_hidden_createdAt_idx" ON "MemorialFlower"("memorialId", "hidden", "createdAt");

-- AddForeignKey
ALTER TABLE "MemorialFlower" ADD CONSTRAINT "MemorialFlower_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

