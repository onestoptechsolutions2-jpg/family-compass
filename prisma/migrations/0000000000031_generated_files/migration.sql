ALTER TABLE "GenerationJob" ADD COLUMN "previewFileId" TEXT;
ALTER TABLE "GenerationJob" ADD COLUMN "outputFileId" TEXT;

CREATE TABLE "GeneratedFile" (
    "id" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "GeneratedFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GeneratedFile_generationJobId_phase_idx" ON "GeneratedFile"("generationJobId", "phase");
CREATE INDEX "GeneratedFile_expiresAt_idx" ON "GeneratedFile"("expiresAt");
ALTER TABLE "GeneratedFile" ADD CONSTRAINT "GeneratedFile_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
