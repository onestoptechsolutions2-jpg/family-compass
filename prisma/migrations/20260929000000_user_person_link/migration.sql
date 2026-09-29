-- AlterTable
ALTER TABLE "User" ADD COLUMN     "personId" TEXT,
ADD COLUMN     "primaryTreeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE INDEX "User_primaryTreeId_idx" ON "User"("primaryTreeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryTreeId_fkey" FOREIGN KEY ("primaryTreeId") REFERENCES "Tree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: the person a user has claimed is their person.
UPDATE "User" u SET "personId" = p."id"
FROM "Person" p
WHERE p."claimedByUserId" = u."id" AND u."personId" IS NULL;

-- Backfill: primary family = the tree of the claimed person, else the oldest
-- tree in the user's oldest owned workspace.
UPDATE "User" u SET "primaryTreeId" = p."treeId"
FROM "Person" p
WHERE p."id" = u."personId" AND u."primaryTreeId" IS NULL;

UPDATE "User" u SET "primaryTreeId" = (
  SELECT t."id" FROM "Membership" m
  JOIN "Tree" t ON t."workspaceId" = m."workspaceId"
  WHERE m."userId" = u."id" AND m."role" = 'OWNER'
  ORDER BY m."createdAt" ASC, t."createdAt" ASC
  LIMIT 1
)
WHERE u."primaryTreeId" IS NULL;

-- Keep User.personId in step with Person.claimedByUserId while both exist, so
-- the ~100 code paths that claim or release a person need no change yet.
CREATE OR REPLACE FUNCTION "sync_user_person"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."claimedByUserId" IS NOT NULL
     AND OLD."claimedByUserId" IS DISTINCT FROM NEW."claimedByUserId" THEN
    UPDATE "User" SET "personId" = NULL
    WHERE "id" = OLD."claimedByUserId" AND "personId" = NEW."id";
  END IF;
  IF NEW."claimedByUserId" IS NOT NULL THEN
    UPDATE "User"
    SET "personId" = NEW."id", "primaryTreeId" = COALESCE("primaryTreeId", NEW."treeId")
    WHERE "id" = NEW."claimedByUserId" AND "personId" IS NULL;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Person_sync_user_person"
AFTER INSERT OR UPDATE OF "claimedByUserId" ON "Person"
FOR EACH ROW EXECUTE FUNCTION "sync_user_person"();
