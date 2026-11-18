-- CreateTable
CREATE TABLE "ContractorCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContractorCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "abn" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractorCompany_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContractorCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractorContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractorContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractorNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractorNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractorNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractorDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractorDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractorInsurance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "policyNumber" TEXT,
    "insurer" TEXT,
    "expiresOn" DATETIME NOT NULL,
    "certificateName" TEXT,
    "certificateStoredName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractorInsurance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorCategory_name_key" ON "ContractorCategory"("name");

-- CreateIndex
CREATE INDEX "ContractorCompany_categoryId_idx" ON "ContractorCompany"("categoryId");

-- CreateIndex
CREATE INDEX "ContractorCompany_status_idx" ON "ContractorCompany"("status");

-- CreateIndex
CREATE INDEX "ContractorContact_companyId_idx" ON "ContractorContact"("companyId");

-- CreateIndex
CREATE INDEX "ContractorNote_companyId_idx" ON "ContractorNote"("companyId");

-- CreateIndex
CREATE INDEX "ContractorDocument_companyId_idx" ON "ContractorDocument"("companyId");

-- CreateIndex
CREATE INDEX "ContractorInsurance_companyId_idx" ON "ContractorInsurance"("companyId");

-- CreateIndex
CREATE INDEX "ContractorInsurance_expiresOn_idx" ON "ContractorInsurance"("expiresOn");
