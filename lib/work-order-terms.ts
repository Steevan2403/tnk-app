import { canEditWorkOrderTerms } from "./roles";

export const COMPANY_SETTINGS_ID = "company";
export const DEFAULT_COMPANY_NAME = "TNK Property Services Pty Ltd";
export const TERMS_MAX = 12000;

export type CompanySettingsInput = {
  companyName: string;
  siteContactName: string;
  siteContactMobile: string;
  siteContactEmail: string;
  workOrderTerms: string;
};

export function companyNameOf(value: string | null | undefined): string {
  const name = value?.trim() ?? "";
  return name || DEFAULT_COMPANY_NAME;
}

export function siteContactValue(buildingValue: string | null | undefined, settingsValue: string | null | undefined): string {
  const primary = buildingValue?.trim() ?? "";
  if (primary) return primary;
  return settingsValue?.trim() ?? "";
}

export function buildingLine(name: string, strataPlan: string | null | undefined): string {
  const plan = strataPlan?.trim();
  return `${name} - ${plan || "N/A"}`;
}

export function assignedContractorLine(company: string, contact: string, phone: string): string {
  return [company.trim(), contact.trim(), phone.trim()].filter((part) => part.length > 0).join(" | ");
}

export function contractorPhone(phone: string | null | undefined, mobile: string | null | undefined): string {
  return phone?.trim() || mobile?.trim() || "";
}

export function appBaseUrl(): string {
  const value = (process.env.APP_BASE_URL || process.env.AUTH_URL || "http://localhost:3000").trim();
  return value.replace(/\/+$/, "");
}

export const PREVIEW_CHECK_IN_TOKEN = "preview";

export function workOrderLinks(id: string, checkInToken: string): { viewUrl: string; checkInUrl: string } {
  const base = appBaseUrl();
  const viewUrl = `${base}/work-orders/${encodeURIComponent(id)}`;
  const checkInUrl = `${base}/check-in/${encodeURIComponent(checkInToken)}`;
  return { viewUrl, checkInUrl };
}

// Keep the terms as typed, including numbering and blank lines. A whitespace-only value is empty.
export function normalizeTerms(value: string): string {
  const terms = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!terms.trim()) return "";
  return terms;
}

export function parseCompanySettingsForm(
  formData: FormData,
): { ok: true; value: CompanySettingsInput } | { ok: false; error: string } {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const siteContactName = String(formData.get("siteContactName") ?? "").trim();
  const siteContactMobile = String(formData.get("siteContactMobile") ?? "").trim();
  const siteContactEmail = String(formData.get("siteContactEmail") ?? "").trim();
  const workOrderTerms = normalizeTerms(String(formData.get("workOrderTerms") ?? ""));

  if (companyName.length > 160) return { ok: false, error: "Use 160 characters or fewer for the company name." };
  if (siteContactName.length > 120) return { ok: false, error: "Use 120 characters or fewer for the site contact." };
  if (siteContactMobile.length > 40) return { ok: false, error: "Use 40 characters or fewer for the mobile." };
  if (siteContactEmail && (!/^[^\s@]+@[^\s@]+$/.test(siteContactEmail) || siteContactEmail.length > 200)) {
    return { ok: false, error: "Enter a valid fallback email." };
  }
  if (workOrderTerms.length > TERMS_MAX) return { ok: false, error: `Use ${TERMS_MAX} characters or fewer for the terms.` };

  return {
    ok: true,
    value: {
      companyName: companyName || DEFAULT_COMPANY_NAME,
      siteContactName,
      siteContactMobile,
      siteContactEmail,
      workOrderTerms,
    },
  };
}

export function decideCompanySettingsSave(
  role: string,
  formData: FormData,
): { ok: true; value: CompanySettingsInput } | { ok: false; error: string } {
  if (!canEditWorkOrderTerms(role)) {
    return { ok: false, error: "You do not have permission to edit work order terms." };
  }
  return parseCompanySettingsForm(formData);
}
