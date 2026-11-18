-- CreateTable
CREATE TABLE "Apartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "occupancy" TEXT NOT NULL DEFAULT 'owner_occupied',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Apartment_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "phone" TEXT,
    "mobile" TEXT,
    "secondaryPhone" TEXT,
    "email" TEXT,
    "moveInOn" DATETIME,
    "moveOutOn" DATETIME,
    "primaryContact" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Resident_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "colour" TEXT,
    "carSpace" TEXT,
    "location" TEXT,
    "photoName" TEXT,
    "photoStoredName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApartmentDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "expiresOn" DATETIME,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApartmentDocument_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApartmentImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApartmentImage_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApartmentNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApartmentNote_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApartmentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApartmentOwner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "postalAddress" TEXT,
    "strataCommittee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApartmentOwner_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagingAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartmentId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagingAgent_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Apartment_buildingId_idx" ON "Apartment"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_buildingId_number_key" ON "Apartment"("buildingId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_buildingId_lotNumber_key" ON "Apartment"("buildingId", "lotNumber");

-- CreateIndex
CREATE INDEX "Resident_apartmentId_idx" ON "Resident"("apartmentId");

-- CreateIndex
CREATE INDEX "Resident_type_idx" ON "Resident"("type");

-- CreateIndex
CREATE INDEX "Vehicle_apartmentId_idx" ON "Vehicle"("apartmentId");

-- CreateIndex
CREATE INDEX "ApartmentDocument_apartmentId_idx" ON "ApartmentDocument"("apartmentId");

-- CreateIndex
CREATE INDEX "ApartmentImage_apartmentId_idx" ON "ApartmentImage"("apartmentId");

-- CreateIndex
CREATE INDEX "ApartmentNote_apartmentId_idx" ON "ApartmentNote"("apartmentId");

-- CreateIndex
CREATE INDEX "ApartmentOwner_apartmentId_idx" ON "ApartmentOwner"("apartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagingAgent_apartmentId_key" ON "ManagingAgent"("apartmentId");

