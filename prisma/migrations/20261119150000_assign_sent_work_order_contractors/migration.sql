-- Cases that already have a sent work order get that company assigned.
-- INSERT OR IGNORE keeps an existing assignment and is safe to run again.
INSERT OR IGNORE INTO "CaseCompany" ("caseId", "companyId")
SELECT DISTINCT "caseId", "companyId"
FROM "WorkOrder"
WHERE "companyId" IS NOT NULL;
