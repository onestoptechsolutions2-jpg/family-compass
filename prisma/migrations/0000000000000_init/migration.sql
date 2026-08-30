
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('INHERIT', 'PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "DateModifier" AS ENUM ('NONE', 'EXACT', 'BEFORE', 'AFTER', 'ABOUT', 'RANGE', 'SPAN');

-- CreateEnum
CREATE TYPE "DateQuality" AS ENUM ('NONE', 'CALCULATED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "NameType" AS ENUM ('BIRTH', 'MARRIED', 'AKA', 'NICKNAME', 'IMMIGRANT', 'MAIDEN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FamilyType" AS ENUM ('MARRIED', 'UNMARRIED', 'CIVIL_UNION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ChildRelation" AS ENUM ('BIRTH', 'ADOPTED', 'STEPCHILD', 'FOSTER', 'SPONSORED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('PRIMARY', 'FAMILY', 'WITNESS', 'CELEBRANT', 'INFORMANT', 'CLERGY', 'AIDE', 'BRIDE', 'GROOM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "NoteFormat" AS ENUM ('PLAIN', 'HTML');

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('PEDIGREE', 'DESCENDANTS', 'HOURGLASS');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('GRAMPS_XML', 'GEDCOM');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "GenerationKind" AS ENUM ('PEDIGREE_PDF', 'FAN_CHART', 'DESCENDANT_CHART', 'FAMILY_BOOK', 'GEDCOM_EXPORT', 'GRAMPS_EXPORT');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('QUEUED', 'RENDERING_PREVIEW', 'PREVIEW_READY', 'AWAITING_PAYMENT', 'PAID', 'RENDERING_OUTPUT', 'OUTPUT_READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AWAITING_VERIFICATION', 'PAID', 'REJECTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationMode" AS ENUM ('MANUAL', 'AUTO_CODE', 'WEBHOOK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tree" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "homePersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "living" BOOLEAN NOT NULL DEFAULT false,
    "privacy" "Privacy" NOT NULL DEFAULT 'INHERIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Name" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" "NameType" NOT NULL DEFAULT 'BIRTH',
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "prefix" TEXT,
    "first" TEXT,
    "nick" TEXT,
    "callName" TEXT,
    "surnamePrefix" TEXT,
    "surname" TEXT,
    "suffix" TEXT,

    CONSTRAINT "Name_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "partner1Id" TEXT,
    "partner2Id" TEXT,
    "type" "FamilyType" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildRef" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "partner1Relation" "ChildRelation" NOT NULL DEFAULT 'BIRTH',
    "partner2Relation" "ChildRelation" NOT NULL DEFAULT 'BIRTH',

    CONSTRAINT "ChildRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dateModifier" "DateModifier" NOT NULL DEFAULT 'NONE',
    "dateQuality" "DateQuality" NOT NULL DEFAULT 'NONE',
    "dateYear" INTEGER,
    "dateMonth" INTEGER,
    "dateDay" INTEGER,
    "dateYear2" INTEGER,
    "dateMonth2" INTEGER,
    "dateDay2" INTEGER,
    "dateText" TEXT,
    "dateSortKey" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRef" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "role" "EventRole" NOT NULL DEFAULT 'PRIMARY',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "code" TEXT,
    "enclosedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "pubInfo" TEXT,
    "abbrev" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "sourceId" TEXT NOT NULL,
    "page" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dateModifier" "DateModifier" NOT NULL DEFAULT 'NONE',
    "dateQuality" "DateQuality" NOT NULL DEFAULT 'NONE',
    "dateYear" INTEGER,
    "dateMonth" INTEGER,
    "dateDay" INTEGER,
    "dateText" TEXT,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationRef" (
    "id" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "eventId" TEXT,

    CONSTRAINT "CitationRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoRef" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "callNumber" TEXT,
    "mediaType" TEXT,

    CONSTRAINT "RepoRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "type" TEXT,
    "format" "NoteFormat" NOT NULL DEFAULT 'PLAIN',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteRef" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "eventId" TEXT,
    "placeId" TEXT,
    "sourceId" TEXT,
    "citationId" TEXT,
    "mediaId" TEXT,
    "repositoryId" TEXT,

    CONSTRAINT "NoteRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "grampsId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnail" BYTEA,
    "thumbMime" TEXT,
    "title" TEXT,
    "dateText" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRef" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "eventId" TEXT,
    "placeId" TEXT,
    "sourceId" TEXT,
    "citationId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "rectX" DOUBLE PRECISION,
    "rectY" DOUBLE PRECISION,
    "rectW" DOUBLE PRECISION,
    "rectH" DOUBLE PRECISION,

    CONSTRAINT "MediaRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "eventId" TEXT,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedView" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "centralPersonId" TEXT NOT NULL,
    "mode" "ShareMode" NOT NULL DEFAULT 'HOURGLASS',
    "generations" INTEGER NOT NULL DEFAULT 4,
    "includeLiving" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "report" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "kind" "GenerationKind" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "params" JSONB NOT NULL,
    "centralPersonId" TEXT,
    "priceKes" INTEGER NOT NULL,
    "previewMediaId" TEXT,
    "outputMediaId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual_mpesa',
    "amountKes" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "reference" TEXT NOT NULL,
    "mpesaCode" TEXT,
    "payerPhone" TEXT,
    "payerNote" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "kind" "GenerationKind" NOT NULL,
    "priceKes" INTEGER NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "provider" TEXT NOT NULL DEFAULT 'manual_mpesa',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "defaultPriceKes" INTEGER NOT NULL DEFAULT 750,
    "tillNumber" TEXT,
    "storeNumber" TEXT,
    "paybillNumber" TEXT,
    "businessName" TEXT,
    "accountRef" TEXT,
    "instructions" TEXT,
    "verificationMode" "VerificationMode" NOT NULL DEFAULT 'MANUAL',
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "treeId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "actorId" TEXT,
    "verb" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PersonTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PersonTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FamilyTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FamilyTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_workspaceId_email_key" ON "Invitation"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Tree_workspaceId_slug_key" ON "Tree"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Person_treeId_idx" ON "Person"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_treeId_grampsId_key" ON "Person"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "Name_personId_idx" ON "Name"("personId");

-- CreateIndex
CREATE INDEX "Name_surname_idx" ON "Name"("surname");

-- CreateIndex
CREATE INDEX "Family_treeId_idx" ON "Family"("treeId");

-- CreateIndex
CREATE INDEX "Family_partner1Id_idx" ON "Family"("partner1Id");

-- CreateIndex
CREATE INDEX "Family_partner2Id_idx" ON "Family"("partner2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Family_treeId_grampsId_key" ON "Family"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "ChildRef_personId_idx" ON "ChildRef"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildRef_familyId_personId_key" ON "ChildRef"("familyId", "personId");

-- CreateIndex
CREATE INDEX "Event_treeId_idx" ON "Event"("treeId");

-- CreateIndex
CREATE INDEX "Event_placeId_idx" ON "Event"("placeId");

-- CreateIndex
CREATE INDEX "Event_dateSortKey_idx" ON "Event"("dateSortKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_treeId_grampsId_key" ON "Event"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "EventRef_eventId_idx" ON "EventRef"("eventId");

-- CreateIndex
CREATE INDEX "EventRef_personId_idx" ON "EventRef"("personId");

-- CreateIndex
CREATE INDEX "EventRef_familyId_idx" ON "EventRef"("familyId");

-- CreateIndex
CREATE INDEX "Place_treeId_idx" ON "Place"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_treeId_grampsId_key" ON "Place"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "Source_treeId_idx" ON "Source"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_treeId_grampsId_key" ON "Source"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "Citation_treeId_idx" ON "Citation"("treeId");

-- CreateIndex
CREATE INDEX "Citation_sourceId_idx" ON "Citation"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Citation_treeId_grampsId_key" ON "Citation"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "CitationRef_citationId_idx" ON "CitationRef"("citationId");

-- CreateIndex
CREATE INDEX "CitationRef_personId_idx" ON "CitationRef"("personId");

-- CreateIndex
CREATE INDEX "CitationRef_familyId_idx" ON "CitationRef"("familyId");

-- CreateIndex
CREATE INDEX "CitationRef_eventId_idx" ON "CitationRef"("eventId");

-- CreateIndex
CREATE INDEX "Repository_treeId_idx" ON "Repository"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_treeId_grampsId_key" ON "Repository"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "RepoRef_repositoryId_idx" ON "RepoRef"("repositoryId");

-- CreateIndex
CREATE INDEX "RepoRef_sourceId_idx" ON "RepoRef"("sourceId");

-- CreateIndex
CREATE INDEX "Note_treeId_idx" ON "Note"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_treeId_grampsId_key" ON "Note"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "NoteRef_noteId_idx" ON "NoteRef"("noteId");

-- CreateIndex
CREATE INDEX "Tag_treeId_idx" ON "Tag"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_treeId_name_key" ON "Tag"("treeId", "name");

-- CreateIndex
CREATE INDEX "MediaObject_treeId_idx" ON "MediaObject"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaObject_treeId_grampsId_key" ON "MediaObject"("treeId", "grampsId");

-- CreateIndex
CREATE INDEX "MediaRef_mediaId_idx" ON "MediaRef"("mediaId");

-- CreateIndex
CREATE INDEX "MediaRef_personId_idx" ON "MediaRef"("personId");

-- CreateIndex
CREATE INDEX "MediaRef_familyId_idx" ON "MediaRef"("familyId");

-- CreateIndex
CREATE INDEX "Attribute_personId_idx" ON "Attribute"("personId");

-- CreateIndex
CREATE INDEX "Attribute_familyId_idx" ON "Attribute"("familyId");

-- CreateIndex
CREATE INDEX "Attribute_eventId_idx" ON "Attribute"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedView_slug_key" ON "SharedView"("slug");

-- CreateIndex
CREATE INDEX "SharedView_treeId_idx" ON "SharedView"("treeId");

-- CreateIndex
CREATE INDEX "SharedView_slug_idx" ON "SharedView"("slug");

-- CreateIndex
CREATE INDEX "ImportJob_treeId_idx" ON "ImportJob"("treeId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "GenerationJob_treeId_idx" ON "GenerationJob"("treeId");

-- CreateIndex
CREATE INDEX "GenerationJob_requestedById_idx" ON "GenerationJob"("requestedById");

-- CreateIndex
CREATE INDEX "GenerationJob_status_idx" ON "GenerationJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_generationJobId_key" ON "Payment"("generationJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_workspaceId_idx" ON "Payment"("workspaceId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_mpesaCode_idx" ON "Payment"("mpesaCode");

-- CreateIndex
CREATE UNIQUE INDEX "PricingConfig_workspaceId_kind_key" ON "PricingConfig"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSettings_scope_key" ON "PaymentSettings"("scope");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditLog_treeId_idx" ON "AuditLog"("treeId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_treeId_createdAt_idx" ON "ActivityEvent"("treeId", "createdAt");

-- CreateIndex
CREATE INDEX "_PersonTags_B_index" ON "_PersonTags"("B");

-- CreateIndex
CREATE INDEX "_FamilyTags_B_index" ON "_FamilyTags"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Name" ADD CONSTRAINT "Name_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_partner1Id_fkey" FOREIGN KEY ("partner1Id") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_partner2Id_fkey" FOREIGN KEY ("partner2Id") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRef" ADD CONSTRAINT "ChildRef_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRef" ADD CONSTRAINT "ChildRef_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRef" ADD CONSTRAINT "EventRef_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRef" ADD CONSTRAINT "EventRef_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRef" ADD CONSTRAINT "EventRef_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_enclosedById_fkey" FOREIGN KEY ("enclosedById") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationRef" ADD CONSTRAINT "CitationRef_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationRef" ADD CONSTRAINT "CitationRef_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationRef" ADD CONSTRAINT "CitationRef_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationRef" ADD CONSTRAINT "CitationRef_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoRef" ADD CONSTRAINT "RepoRef_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoRef" ADD CONSTRAINT "RepoRef_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRef" ADD CONSTRAINT "NoteRef_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRef" ADD CONSTRAINT "MediaRef_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedView" ADD CONSTRAINT "SharedView_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedView" ADD CONSTRAINT "SharedView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedView" ADD CONSTRAINT "SharedView_centralPersonId_fkey" FOREIGN KEY ("centralPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_centralPersonId_fkey" FOREIGN KEY ("centralPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_previewMediaId_fkey" FOREIGN KEY ("previewMediaId") REFERENCES "MediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_outputMediaId_fkey" FOREIGN KEY ("outputMediaId") REFERENCES "MediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingConfig" ADD CONSTRAINT "PricingConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonTags" ADD CONSTRAINT "_PersonTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonTags" ADD CONSTRAINT "_PersonTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FamilyTags" ADD CONSTRAINT "_FamilyTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FamilyTags" ADD CONSTRAINT "_FamilyTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

