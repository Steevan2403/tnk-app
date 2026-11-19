-- CreateTable
CREATE TABLE "WorkOrderVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "contractorName" TEXT NOT NULL,
    "checkedInAt" DATETIME NOT NULL,
    "checkedOutAt" DATETIME,
    "checkInLatitude" REAL,
    "checkInLongitude" REAL,
    "checkOutLatitude" REAL,
    "checkOutLongitude" REAL,
    "openKey" TEXT,
    CONSTRAINT "WorkOrderVisit_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "companyId" TEXT,
    "companyName" TEXT NOT NULL,
    "contactId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "attendingAt" DATETIME,
    "purchaseOrderNumber" TEXT,
    "accessNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "sentAt" DATETIME NOT NULL,
    "sentById" TEXT NOT NULL,
    "pdfStoredName" TEXT NOT NULL,
    "pdfName" TEXT NOT NULL,
    "checkInToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContractorContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkOrder" ("accessNotes", "attendingAt", "caseId", "checkInToken", "companyId", "companyName", "contactEmail", "contactId", "contactName", "createdAt", "id", "message", "pdfName", "pdfStoredName", "purchaseOrderNumber", "sentAt", "sentById", "status", "subject", "suffix", "updatedAt") SELECT "accessNotes", "attendingAt", "caseId", lower(hex(randomblob(32))), "companyId", "companyName", "contactEmail", "contactId", "contactName", "createdAt", "id", "message", "pdfName", "pdfStoredName", "purchaseOrderNumber", "sentAt", "sentById", "status", "subject", "suffix", "updatedAt" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE UNIQUE INDEX "WorkOrder_checkInToken_key" ON "WorkOrder"("checkInToken");
CREATE INDEX "WorkOrder_companyId_idx" ON "WorkOrder"("companyId");
CREATE INDEX "WorkOrder_contactId_idx" ON "WorkOrder"("contactId");
CREATE INDEX "WorkOrder_sentById_idx" ON "WorkOrder"("sentById");
CREATE INDEX "WorkOrder_sentAt_idx" ON "WorkOrder"("sentAt");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");
CREATE UNIQUE INDEX "WorkOrder_caseId_suffix_key" ON "WorkOrder"("caseId", "suffix");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WorkOrderVisit_checkedInAt_idx" ON "WorkOrderVisit"("checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderVisit_workOrderId_openKey_key" ON "WorkOrderVisit"("workOrderId", "openKey");
