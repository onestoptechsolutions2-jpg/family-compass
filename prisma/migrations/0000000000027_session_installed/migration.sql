ALTER TABLE "Session" ADD COLUMN "standalone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN "installedAt" TIMESTAMP(3);

CREATE INDEX "Session_standalone_idx" ON "Session"("standalone");
