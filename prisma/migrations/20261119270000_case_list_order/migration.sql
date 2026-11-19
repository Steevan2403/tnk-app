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
    "priorityRank" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'new',
    "statusRank" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Case" ("apartmentId", "area", "buildingId", "completedAt", "createdAt", "createdById", "descriptionHtml", "dueDate", "id", "includeInReport", "inspectionItemId", "internalNotes", "maintenanceEventId", "number", "occurrenceOn", "priority", "purchaseOrderNumber", "startDate", "status", "subject", "typeId", "updatedAt") SELECT "apartmentId", "area", "buildingId", "completedAt", "createdAt", "createdById", "descriptionHtml", "dueDate", "id", "includeInReport", "inspectionItemId", "internalNotes", "maintenanceEventId", "number", "occurrenceOn", "priority", "purchaseOrderNumber", "startDate", "status", "subject", "typeId", "updatedAt" FROM "Case";
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

-- Keep the list order used before this column existed.
UPDATE "Case" SET "priorityRank" = CASE "priority"
  WHEN 'urgent' THEN 0
  WHEN 'high' THEN 1
  WHEN 'medium' THEN 2
  ELSE 3
END;
UPDATE "Case" SET "statusRank" = CASE "status"
  WHEN 'new' THEN 0
  WHEN 'in_progress' THEN 1
  WHEN 'awaiting_contractor' THEN 2
  WHEN 'awaiting_quote' THEN 3
  WHEN 'awaiting_invoice' THEN 4
  WHEN 'completed' THEN 5
  ELSE 6
END;
