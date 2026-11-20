-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OutboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "buildingId" TEXT,
    "workOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboxMessage_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboxMessage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OutboxMessage" ("body", "createdAt", "id", "subject", "toAddress", "workOrderId") SELECT "body", "createdAt", "id", "subject", "toAddress", "workOrderId" FROM "OutboxMessage";
DROP TABLE "OutboxMessage";
ALTER TABLE "new_OutboxMessage" RENAME TO "OutboxMessage";
CREATE INDEX "OutboxMessage_buildingId_idx" ON "OutboxMessage"("buildingId");
CREATE INDEX "OutboxMessage_workOrderId_idx" ON "OutboxMessage"("workOrderId");
CREATE INDEX "OutboxMessage_createdAt_idx" ON "OutboxMessage"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Mail already sent for a work order belongs to that work order's building.
UPDATE "OutboxMessage"
SET "buildingId" = (
  SELECT "Case"."buildingId"
  FROM "WorkOrder"
  INNER JOIN "Case" ON "Case"."id" = "WorkOrder"."caseId"
  WHERE "WorkOrder"."id" = "OutboxMessage"."workOrderId"
)
WHERE "workOrderId" IS NOT NULL;
