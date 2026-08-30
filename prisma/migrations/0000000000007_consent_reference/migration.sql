-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "researchConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceClan" (
    "id" TEXT NOT NULL,
    "community" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "aka" TEXT,
    "totem" TEXT,
    "region" TEXT,
    "notes" TEXT,
    "source" TEXT,

    CONSTRAINT "ReferenceClan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentEvent_userId_createdAt_idx" ON "ConsentEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferenceClan_community_idx" ON "ReferenceClan"("community");

-- CreateIndex
CREATE INDEX "ReferenceClan_normalized_idx" ON "ReferenceClan"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceClan_community_normalized_key" ON "ReferenceClan"("community", "normalized");

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

