-- CreateTable
CREATE TABLE "BuildingActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuildingActivity_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildingActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InspectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "templateId" TEXT,
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
    CONSTRAINT "InspectionRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InspectionRun_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InspectionRun_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InspectionRun" ("apartmentId", "buildingId", "completedAt", "createdAt", "id", "inspectedAt", "inspectorId", "name", "status", "templateId", "type", "updatedAt") SELECT "apartmentId", "buildingId", "completedAt", "createdAt", "id", "inspectedAt", "inspectorId", "name", "status", "templateId", "type", "updatedAt" FROM "InspectionRun";
DROP TABLE "InspectionRun";
ALTER TABLE "new_InspectionRun" RENAME TO "InspectionRun";
CREATE INDEX "InspectionRun_buildingId_status_idx" ON "InspectionRun"("buildingId", "status");
CREATE INDEX "InspectionRun_templateId_idx" ON "InspectionRun"("templateId");
CREATE INDEX "InspectionRun_inspectorId_idx" ON "InspectionRun"("inspectorId");
CREATE INDEX "InspectionRun_apartmentId_idx" ON "InspectionRun"("apartmentId");
CREATE INDEX "InspectionRun_completedAt_idx" ON "InspectionRun"("completedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BuildingActivity_buildingId_createdAt_idx" ON "BuildingActivity"("buildingId", "createdAt");

-- CreateIndex
CREATE INDEX "BuildingActivity_actorId_idx" ON "BuildingActivity"("actorId");
