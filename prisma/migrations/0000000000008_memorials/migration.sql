-- CreateEnum
CREATE TYPE "GuestbookStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- AlterEnum
ALTER TYPE "GenerationKind" ADD VALUE 'MEMORIAL_BOOK';

-- CreateTable
CREATE TABLE "Memorial" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "eulogy" TEXT,
    "bornText" TEXT,
    "diedText" TEXT,
    "restingPlace" TEXT,
    "serviceText" TEXT,
    "coverMediaId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "guestbookOpen" BOOLEAN NOT NULL DEFAULT true,
    "guestbookModerated" BOOLEAN NOT NULL DEFAULT true,
    "includeLiving" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestbookEntry" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "message" TEXT NOT NULL,
    "phone" TEXT,
    "status" "GuestbookStatus" NOT NULL DEFAULT 'PENDING',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuneralProgram" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "venue" TEXT,
    "serviceDate" TIMESTAMP(3),
    "committee" TEXT,
    "order" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuneralProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramRevision" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "editedById" TEXT,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Memorial_personId_key" ON "Memorial"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Memorial_slug_key" ON "Memorial"("slug");

-- CreateIndex
CREATE INDEX "Memorial_treeId_idx" ON "Memorial"("treeId");

-- CreateIndex
CREATE INDEX "GuestbookEntry_memorialId_status_idx" ON "GuestbookEntry"("memorialId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FuneralProgram_memorialId_key" ON "FuneralProgram"("memorialId");

-- CreateIndex
CREATE INDEX "ProgramRevision_programId_createdAt_idx" ON "ProgramRevision"("programId", "createdAt");

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestbookEntry" ADD CONSTRAINT "GuestbookEntry_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuneralProgram" ADD CONSTRAINT "FuneralProgram_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuneralProgram" ADD CONSTRAINT "FuneralProgram_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRevision" ADD CONSTRAINT "ProgramRevision_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FuneralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRevision" ADD CONSTRAINT "ProgramRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

