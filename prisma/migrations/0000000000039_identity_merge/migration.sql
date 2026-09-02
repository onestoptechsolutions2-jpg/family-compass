-- CreateTable
CREATE TABLE "IdentityMergeApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityMergeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityMergeApproval_requestId_idx" ON "IdentityMergeApproval"("requestId");

-- CreateIndex
CREATE INDEX "IdentityMergeApproval_treeId_idx" ON "IdentityMergeApproval"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityMergeApproval_requestId_treeId_key" ON "IdentityMergeApproval"("requestId", "treeId");

-- AddForeignKey
ALTER TABLE "IdentityMergeApproval" ADD CONSTRAINT "IdentityMergeApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IdentityMergeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMergeApproval" ADD CONSTRAINT "IdentityMergeApproval_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMergeApproval" ADD CONSTRAINT "IdentityMergeApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
