-- Optional job area on an inspection. Existing rows stay unset, which means N/A.
ALTER TABLE "InspectionRun" ADD COLUMN "area" TEXT;

-- CreateTable
CREATE TABLE "InspectionRunAsset" (
    "runId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    PRIMARY KEY ("runId", "assetId"),
    CONSTRAINT "InspectionRunAsset_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InspectionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionRunAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InspectionRunAsset_assetId_idx" ON "InspectionRunAsset"("assetId");
