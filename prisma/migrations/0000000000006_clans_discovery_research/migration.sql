-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('REQUESTED', 'QUOTED', 'AWAITING_PAYMENT', 'ACTIVE', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentKind" ADD VALUE 'DEEP_SEARCH';
ALTER TYPE "PaymentKind" ADD VALUE 'RESEARCH_PARTNER';

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "community" TEXT,
ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "clanId" TEXT,
ADD COLUMN     "subClan" TEXT;

-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "nodeCount" INTEGER;

-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "deepSearchPriceKes" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "priceFreeGenerations" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "priceFreeNodes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "pricePerGenerationKes" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "pricePerNodeKes" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "researchBaseKes" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "researchPerGenerationKes" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "researchPerNodeKes" INTEGER NOT NULL DEFAULT 200;

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "aka" TEXT,
    "community" TEXT,
    "totem" TEXT,
    "origin" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationPricing" (
    "kind" "GenerationKind" NOT NULL,
    "baseKes" INTEGER NOT NULL DEFAULT 750,

    CONSTRAINT "GenerationPricing_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "KenyaLocation" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "subcounty" TEXT,
    "ward" TEXT,
    "path" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "KenyaLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepSearch" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeepSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEngagement" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "community" TEXT,
    "region" TEXT,
    "generationsTarget" INTEGER,
    "nodesTarget" INTEGER,
    "status" "EngagementStatus" NOT NULL DEFAULT 'REQUESTED',
    "quotedKes" INTEGER,
    "quoteNote" TEXT,
    "paymentId" TEXT,
    "assignedToId" TEXT,
    "deliverableUrl" TEXT,
    "deliveryNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Clan_normalized_idx" ON "Clan"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_treeId_normalized_key" ON "Clan"("treeId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "KenyaLocation_path_key" ON "KenyaLocation"("path");

-- CreateIndex
CREATE INDEX "KenyaLocation_county_idx" ON "KenyaLocation"("county");

-- CreateIndex
CREATE INDEX "KenyaLocation_region_idx" ON "KenyaLocation"("region");

-- CreateIndex
CREATE UNIQUE INDEX "DeepSearch_paymentId_key" ON "DeepSearch"("paymentId");

-- CreateIndex
CREATE INDEX "DeepSearch_requesterId_idx" ON "DeepSearch"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEngagement_paymentId_key" ON "ResearchEngagement"("paymentId");

-- CreateIndex
CREATE INDEX "ResearchEngagement_status_idx" ON "ResearchEngagement"("status");

-- CreateIndex
CREATE INDEX "ResearchEngagement_requestedById_idx" ON "ResearchEngagement"("requestedById");

-- CreateIndex
CREATE INDEX "Tree_discoverable_idx" ON "Tree"("discoverable");

-- AddForeignKey
ALTER TABLE "Clan" ADD CONSTRAINT "Clan_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepSearch" ADD CONSTRAINT "DeepSearch_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepSearch" ADD CONSTRAINT "DeepSearch_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEngagement" ADD CONSTRAINT "ResearchEngagement_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEngagement" ADD CONSTRAINT "ResearchEngagement_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEngagement" ADD CONSTRAINT "ResearchEngagement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

