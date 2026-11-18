-- CreateTable
CREATE TABLE "CaseType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "typeId" TEXT NOT NULL,
    "purchaseOrderNumber" TEXT,
    "startDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'new',
    "completedAt" DATETIME,
    "subject" TEXT NOT NULL,
    "descriptionHtml" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT,
    "includeInReport" BOOLEAN NOT NULL DEFAULT true,
    "area" TEXT NOT NULL DEFAULT 'none',
    "apartmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Case_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CaseType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseAsset" (
    "caseId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    PRIMARY KEY ("caseId", "assetId"),
    CONSTRAINT "CaseAsset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseCompany" (
    "caseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    PRIMARY KEY ("caseId", "companyId"),
    CONSTRAINT "CaseCompany_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseContact" (
    "caseId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    PRIMARY KEY ("caseId", "contactId"),
    CONSTRAINT "CaseContact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContractorContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseFile_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseComment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CaseComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseActivity_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseStar" (
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "caseId"),
    CONSTRAINT "CaseStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseStar_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrder_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseType_name_key" ON "CaseType"("name");

-- CreateIndex
CREATE INDEX "Case_buildingId_status_idx" ON "Case"("buildingId", "status");

-- CreateIndex
CREATE INDEX "Case_buildingId_startDate_idx" ON "Case"("buildingId", "startDate");

-- CreateIndex
CREATE INDEX "Case_typeId_idx" ON "Case"("typeId");

-- CreateIndex
CREATE INDEX "Case_apartmentId_idx" ON "Case"("apartmentId");

-- CreateIndex
CREATE INDEX "Case_createdById_idx" ON "Case"("createdById");

-- CreateIndex
CREATE INDEX "Case_dueDate_idx" ON "Case"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Case_buildingId_number_key" ON "Case"("buildingId", "number");

-- CreateIndex
CREATE INDEX "CaseAsset_assetId_idx" ON "CaseAsset"("assetId");

-- CreateIndex
CREATE INDEX "CaseCompany_companyId_idx" ON "CaseCompany"("companyId");

-- CreateIndex
CREATE INDEX "CaseContact_contactId_idx" ON "CaseContact"("contactId");

-- CreateIndex
CREATE INDEX "CaseFile_caseId_idx" ON "CaseFile"("caseId");

-- CreateIndex
CREATE INDEX "CaseFile_uploadedById_idx" ON "CaseFile"("uploadedById");

-- CreateIndex
CREATE INDEX "CaseComment_caseId_idx" ON "CaseComment"("caseId");

-- CreateIndex
CREATE INDEX "CaseComment_parentId_idx" ON "CaseComment"("parentId");

-- CreateIndex
CREATE INDEX "CaseComment_authorId_idx" ON "CaseComment"("authorId");

-- CreateIndex
CREATE INDEX "CaseActivity_caseId_idx" ON "CaseActivity"("caseId");

-- CreateIndex
CREATE INDEX "CaseActivity_actorId_idx" ON "CaseActivity"("actorId");

-- CreateIndex
CREATE INDEX "CaseStar_caseId_idx" ON "CaseStar"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_caseId_suffix_key" ON "WorkOrder"("caseId", "suffix");
