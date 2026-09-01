-- Clan / family-name inheritance rule per tree
CREATE TYPE "ClanInheritance" AS ENUM ('PATRILINEAL', 'MATRILINEAL', 'NONE');

ALTER TABLE "Tree" ADD COLUMN "clanInheritance" "ClanInheritance" NOT NULL DEFAULT 'PATRILINEAL';
ALTER TABLE "Tree" ADD COLUMN "inheritSurname" BOOLEAN NOT NULL DEFAULT true;

-- "named after" — the relative a person was named for (same-tree pointer)
ALTER TABLE "Person" ADD COLUMN "namedAfterId" TEXT;
CREATE INDEX "Person_namedAfterId_idx" ON "Person"("namedAfterId");
ALTER TABLE "Person" ADD CONSTRAINT "Person_namedAfterId_fkey" FOREIGN KEY ("namedAfterId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
