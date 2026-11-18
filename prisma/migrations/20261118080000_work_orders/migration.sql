-- CreateTable
CREATE TABLE "WorkOrderFile" (
    "workOrderId" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,

    PRIMARY KEY ("workOrderId", "caseFileId"),
    CONSTRAINT "WorkOrderFile_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderFile_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "workOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboxMessage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboxAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    CONSTRAINT "OutboxAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "OutboxMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContractorContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkOrder" ("caseId", "createdAt", "id", "suffix") SELECT "caseId", "createdAt", "id", "suffix" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE INDEX "WorkOrder_companyId_idx" ON "WorkOrder"("companyId");
CREATE INDEX "WorkOrder_contactId_idx" ON "WorkOrder"("contactId");
CREATE INDEX "WorkOrder_sentById_idx" ON "WorkOrder"("sentById");
CREATE INDEX "WorkOrder_sentAt_idx" ON "WorkOrder"("sentAt");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");
CREATE UNIQUE INDEX "WorkOrder_caseId_suffix_key" ON "WorkOrder"("caseId", "suffix");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WorkOrderFile_caseFileId_idx" ON "WorkOrderFile"("caseFileId");

-- CreateIndex
CREATE INDEX "OutboxMessage_workOrderId_idx" ON "OutboxMessage"("workOrderId");

-- CreateIndex
CREATE INDEX "OutboxMessage_createdAt_idx" ON "OutboxMessage"("createdAt");

-- CreateIndex
CREATE INDEX "OutboxAttachment_messageId_idx" ON "OutboxAttachment"("messageId");
