-- Friend links: chosen family that lives in a different tree

CREATE TABLE "FriendInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fromTreeId" TEXT NOT NULL,
    "fromPersonId" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeName" TEXT NOT NULL,
    "inviteePhone" TEXT,
    "roleHint" TEXT NOT NULL DEFAULT 'friend',
    "originText" TEXT,
    "originContext" TEXT,
    "originViaPersonId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedPersonId" TEXT,
    "linkId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FriendInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FriendInvite_token_key" ON "FriendInvite"("token");
CREATE INDEX "FriendInvite_fromPersonId_idx" ON "FriendInvite"("fromPersonId");
CREATE INDEX "FriendInvite_status_idx" ON "FriendInvite"("status");

CREATE TABLE "FriendLink" (
    "id" TEXT NOT NULL,
    "aPersonId" TEXT NOT NULL,
    "aTreeId" TEXT NOT NULL,
    "bPersonId" TEXT NOT NULL,
    "bTreeId" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "originText" TEXT,
    "originContext" TEXT,
    "originViaPersonId" TEXT,
    "invitedByUserId" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstMemoryAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FriendLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FriendLink_aPersonId_bPersonId_key" ON "FriendLink"("aPersonId", "bPersonId");
CREATE INDEX "FriendLink_aPersonId_idx" ON "FriendLink"("aPersonId");
CREATE INDEX "FriendLink_bPersonId_idx" ON "FriendLink"("bPersonId");

CREATE TABLE "FriendLinkAssertion" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "byPersonId" TEXT NOT NULL,
    "role" TEXT,
    "assertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FriendLinkAssertion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FriendLinkAssertion_linkId_byPersonId_key" ON "FriendLinkAssertion"("linkId", "byPersonId");

ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_fromTreeId_fkey" FOREIGN KEY ("fromTreeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_fromPersonId_fkey" FOREIGN KEY ("fromPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_originViaPersonId_fkey" FOREIGN KEY ("originViaPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "FriendLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FriendLink" ADD CONSTRAINT "FriendLink_aPersonId_fkey" FOREIGN KEY ("aPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendLink" ADD CONSTRAINT "FriendLink_aTreeId_fkey" FOREIGN KEY ("aTreeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendLink" ADD CONSTRAINT "FriendLink_bPersonId_fkey" FOREIGN KEY ("bPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendLink" ADD CONSTRAINT "FriendLink_bTreeId_fkey" FOREIGN KEY ("bTreeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendLinkAssertion" ADD CONSTRAINT "FriendLinkAssertion_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "FriendLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendLinkAssertion" ADD CONSTRAINT "FriendLinkAssertion_byPersonId_fkey" FOREIGN KEY ("byPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
