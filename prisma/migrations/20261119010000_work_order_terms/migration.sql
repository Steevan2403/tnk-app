-- AlterTable
ALTER TABLE "Building" ADD COLUMN "strataPlan" TEXT;
ALTER TABLE "Building" ADD COLUMN "siteContactName" TEXT;
ALTER TABLE "Building" ADD COLUMN "siteContactMobile" TEXT;
ALTER TABLE "Building" ADD COLUMN "siteContactEmail" TEXT;

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL DEFAULT 'TNK Property Services Pty Ltd',
    "siteContactName" TEXT NOT NULL DEFAULT '',
    "siteContactMobile" TEXT NOT NULL DEFAULT '',
    "siteContactEmail" TEXT NOT NULL DEFAULT '',
    "workOrderTerms" TEXT NOT NULL DEFAULT ''
);
