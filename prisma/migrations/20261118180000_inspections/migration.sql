-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionTemplate_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guidance" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionItem_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InspectionArea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apartmentId" TEXT,
    "inspectorId" TEXT NOT NULL,
    "inspectedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionRun_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectionRun_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InspectionRun_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRunArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "InspectionRunArea_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InspectionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guidance" TEXT,
    "position" INTEGER NOT NULL,
    "result" TEXT,
    "comment" TEXT,
    CONSTRAINT "InspectionRunItem_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "InspectionRunArea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InspectionRunItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "inspectionItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Case_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CaseType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionRunItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("apartmentId", "area", "buildingId", "completedAt", "createdAt", "createdById", "descriptionHtml", "dueDate", "id", "includeInReport", "internalNotes", "maintenanceEventId", "number", "occurrenceOn", "priority", "purchaseOrderNumber", "startDate", "status", "subject", "typeId", "updatedAt") SELECT "apartmentId", "area", "buildingId", "completedAt", "createdAt", "createdById", "descriptionHtml", "dueDate", "id", "includeInReport", "internalNotes", "maintenanceEventId", "number", "occurrenceOn", "priority", "purchaseOrderNumber", "startDate", "status", "subject", "typeId", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_inspectionItemId_key" ON "Case"("inspectionItemId");
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
CREATE INDEX "InspectionTemplate_buildingId_idx" ON "InspectionTemplate"("buildingId");

-- CreateIndex
CREATE INDEX "InspectionTemplate_type_idx" ON "InspectionTemplate"("type");

-- CreateIndex
CREATE INDEX "InspectionArea_templateId_idx" ON "InspectionArea"("templateId");

-- CreateIndex
CREATE INDEX "InspectionItem_areaId_idx" ON "InspectionItem"("areaId");

-- CreateIndex
CREATE INDEX "InspectionRun_buildingId_status_idx" ON "InspectionRun"("buildingId", "status");

-- CreateIndex
CREATE INDEX "InspectionRun_templateId_idx" ON "InspectionRun"("templateId");

-- CreateIndex
CREATE INDEX "InspectionRun_inspectorId_idx" ON "InspectionRun"("inspectorId");

-- CreateIndex
CREATE INDEX "InspectionRun_apartmentId_idx" ON "InspectionRun"("apartmentId");

-- CreateIndex
CREATE INDEX "InspectionRun_completedAt_idx" ON "InspectionRun"("completedAt");

-- CreateIndex
CREATE INDEX "InspectionRunArea_runId_idx" ON "InspectionRunArea"("runId");

-- CreateIndex
CREATE INDEX "InspectionRunItem_areaId_idx" ON "InspectionRunItem"("areaId");

-- CreateIndex
CREATE INDEX "InspectionRunItem_result_idx" ON "InspectionRunItem"("result");

-- CreateIndex
CREATE INDEX "InspectionPhoto_itemId_idx" ON "InspectionPhoto"("itemId");

