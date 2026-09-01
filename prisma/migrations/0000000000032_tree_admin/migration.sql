ALTER TABLE "Tree" ADD COLUMN "adminUserId" TEXT;
CREATE INDEX "Tree_adminUserId_idx" ON "Tree"("adminUserId");
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: the family admin defaults to the workspace's first OWNER.
UPDATE "Tree" t
SET "adminUserId" = (
  SELECT m."userId" FROM "Membership" m
  WHERE m."workspaceId" = t."workspaceId" AND m."role" = 'OWNER'
  ORDER BY m."id" LIMIT 1
)
WHERE t."adminUserId" IS NULL;
