import { prisma } from "./db";
import {
  COMPANY_SETTINGS_ID,
  companyNameOf,
  type CompanySettingsInput,
} from "./work-order-terms";

export type CompanySettingsRecord = CompanySettingsInput & { id: string };

export async function getCompanySettings(): Promise<CompanySettingsRecord> {
  const row = await prisma.companySettings.findUnique({ where: { id: COMPANY_SETTINGS_ID } });
  if (!row) {
    return {
      id: COMPANY_SETTINGS_ID,
      companyName: companyNameOf(null),
      siteContactName: "",
      siteContactMobile: "",
      siteContactEmail: "",
      workOrderTerms: "",
    };
  }
  return {
    id: row.id,
    companyName: companyNameOf(row.companyName),
    siteContactName: row.siteContactName.trim(),
    siteContactMobile: row.siteContactMobile.trim(),
    siteContactEmail: row.siteContactEmail.trim(),
    workOrderTerms: row.workOrderTerms,
  };
}
