-- CreateTable
CREATE TABLE "ApartmentKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApartmentKey_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ApartmentKey_apartmentId_idx" ON "ApartmentKey"("apartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ApartmentKey_apartmentId_number_key" ON "ApartmentKey"("apartmentId", "number");
