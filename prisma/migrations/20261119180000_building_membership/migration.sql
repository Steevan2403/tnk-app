-- CreateTable
CREATE TABLE "UserBuilding" (
    "userId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "buildingId"),
    CONSTRAINT "UserBuilding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBuilding_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserBuilding_buildingId_idx" ON "UserBuilding"("buildingId");

-- Managers and staff keep the access they already have: every current building.
-- Admins are omitted because they can open every building without a membership row.
INSERT OR IGNORE INTO "UserBuilding" ("userId", "buildingId")
SELECT "User"."id", "Building"."id"
FROM "User"
CROSS JOIN "Building"
WHERE "User"."role" != 'admin';
