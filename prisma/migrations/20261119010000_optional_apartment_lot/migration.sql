-- Make Apartment.lotNumber optional. Existing lot numbers are copied unchanged.
-- SQLite cannot alter a column in place, so the table is rebuilt.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Apartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "lotNumber" TEXT,
    "occupancy" TEXT NOT NULL DEFAULT 'owner_occupied',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Apartment_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Apartment" ("buildingId", "createdAt", "id", "lotNumber", "number", "occupancy", "updatedAt") SELECT "buildingId", "createdAt", "id", "lotNumber", "number", "occupancy", "updatedAt" FROM "Apartment";
DROP TABLE "Apartment";
ALTER TABLE "new_Apartment" RENAME TO "Apartment";
CREATE INDEX "Apartment_buildingId_idx" ON "Apartment"("buildingId");
CREATE UNIQUE INDEX "Apartment_buildingId_number_key" ON "Apartment"("buildingId", "number");
CREATE UNIQUE INDEX "Apartment_buildingId_lotNumber_key" ON "Apartment"("buildingId", "lotNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
