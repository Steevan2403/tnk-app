-- CreateTable
CREATE TABLE "MaintenanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "frequency" TEXT NOT NULL,
    "intervalMonths" INTEGER,
    "remindContractor" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" INTEGER NOT NULL DEFAULT 7,
    "area" TEXT NOT NULL DEFAULT 'none',
    "apartmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceEvent_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceEvent_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceAsset" (
    "eventId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    PRIMARY KEY ("eventId", "assetId"),
    CONSTRAINT "MaintenanceAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceCompany" (
    "eventId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    PRIMARY KEY ("eventId", "companyId"),
    CONSTRAINT "MaintenanceCompany_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ContractorCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceContact" (
    "eventId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    PRIMARY KEY ("eventId", "contactId"),
    CONSTRAINT "MaintenanceContact_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContractorContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "occursOn" DATETIME NOT NULL,
    "state" TEXT NOT NULL,
    "note" TEXT,
    "fileName" TEXT,
    "fileStoredName" TEXT,
    "actedAt" DATETIME NOT NULL,
    "actedById" TEXT NOT NULL,
    CONSTRAINT "MaintenanceOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceOccurrence_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "occursOn" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
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
    "maintenanceEventId" TEXT,
    "occurrenceOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Case_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CaseType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("apartmentId", "area", "buildingId", "completedAt", "createdAt", "createdById", "descriptionHtml", "dueDate", "id", "includeInReport", "internalNotes", "number", "priority", "purchaseOrderNumber", "startDate", "status", "subject", "typeId", "updatedAt") SELECT "apartmentId", "area", "buildingId", "completedAt", "createdAt", "createdById", "descriptionHtml", "dueDate", "id", "includeInReport", "internalNotes", "number", "priority", "purchaseOrderNumber", "startDate", "status", "subject", "typeId", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE INDEX "Case_buildingId_status_idx" ON "Case"("buildingId", "status");
CREATE INDEX "Case_buildingId_startDate_idx" ON "Case"("buildingId", "startDate");
CREATE INDEX "Case_typeId_idx" ON "Case"("typeId");
CREATE INDEX "Case_apartmentId_idx" ON "Case"("apartmentId");
CREATE INDEX "Case_createdById_idx" ON "Case"("createdById");
CREATE INDEX "Case_dueDate_idx" ON "Case"("dueDate");
CREATE INDEX "Case_maintenanceEventId_idx" ON "Case"("maintenanceEventId");
CREATE UNIQUE INDEX "Case_buildingId_number_key" ON "Case"("buildingId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MaintenanceEvent_buildingId_startDate_idx" ON "MaintenanceEvent"("buildingId", "startDate");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_frequency_idx" ON "MaintenanceEvent"("frequency");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_apartmentId_idx" ON "MaintenanceEvent"("apartmentId");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_createdById_idx" ON "MaintenanceEvent"("createdById");

-- CreateIndex
CREATE INDEX "MaintenanceAsset_assetId_idx" ON "MaintenanceAsset"("assetId");

-- CreateIndex
CREATE INDEX "MaintenanceCompany_companyId_idx" ON "MaintenanceCompany"("companyId");

-- CreateIndex
CREATE INDEX "MaintenanceContact_contactId_idx" ON "MaintenanceContact"("contactId");

-- CreateIndex
CREATE INDEX "MaintenanceFile_eventId_idx" ON "MaintenanceFile"("eventId");

-- CreateIndex
CREATE INDEX "MaintenanceOccurrence_occursOn_idx" ON "MaintenanceOccurrence"("occursOn");

-- CreateIndex
CREATE INDEX "MaintenanceOccurrence_actedById_idx" ON "MaintenanceOccurrence"("actedById");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceOccurrence_eventId_occursOn_key" ON "MaintenanceOccurrence"("eventId", "occursOn");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_occursOn_idx" ON "MaintenanceReminder"("occursOn");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceReminder_eventId_occursOn_key" ON "MaintenanceReminder"("eventId", "occursOn");

