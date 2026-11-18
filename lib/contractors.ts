export const PAGE_SIZE = 50;

export const CONTRACTOR_TABS = ["contacts", "companies", "expired", "pending"] as const;

export type ContractorTab = (typeof CONTRACTOR_TABS)[number];

export type InsuranceStanding = "none" | "current" | "expired";

export type CompanyInput = {
  name: string;
  abn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categoryId: string;
};

export type CompanyField = keyof CompanyInput;

export type ContactInput = {
  name: string;
  title: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
};

export type ContactField = keyof ContactInput;

export type InsuranceInput = {
  type: string;
  policyNumber: string | null;
  insurer: string | null;
  expiresOn: Date;
};

export type InsuranceField = keyof InsuranceInput | "certificate";

export type NoteField = "body";

export type DocumentField = "name" | "file";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseTab(value: string): ContractorTab {
  return CONTRACTOR_TABS.includes(value as ContractorTab) ? (value as ContractorTab) : "contacts";
}

export function parsePage(value: string): number {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) return 1;
  if (page > 10000) return 10000;
  return page;
}

export function normalizeAbn(value: string): { ok: true; abn: string | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, abn: null };
  const digits = trimmed.replace(/[\s-]/g, "");
  if (!/^\d{11}$/.test(digits)) return { ok: false };
  return { ok: true, abn: digits };
}

export function normalizeEmail(value: string): { ok: true; email: string | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, email: null };
  if (trimmed.length > 200 || !EMAIL.test(trimmed)) return { ok: false };
  return { ok: true, email: trimmed.toLowerCase() };
}

export function normalizeWebsite(value: string): { ok: true; website: string | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, website: null };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
    if (url.toString().length > 300) return { ok: false };
    return { ok: true, website: url.toString() };
  } catch {
    return { ok: false };
  }
}

export function parseCompanyForm(
  formData: FormData,
): { ok: true; value: CompanyInput } | { ok: false; errors: Partial<Record<CompanyField, string>> } {
  const errors: Partial<Record<CompanyField, string>> = {};
  const name = stringValue(formData, "name");
  const address = stringValue(formData, "address");
  const phone = stringValue(formData, "phone");
  const categoryId = stringValue(formData, "categoryId");
  const abn = normalizeAbn(stringValue(formData, "abn"));
  const email = normalizeEmail(stringValue(formData, "email"));
  const website = normalizeWebsite(stringValue(formData, "website"));

  if (!name) errors.name = "Enter a company name.";
  else {
    const length = lengthError(name, 160);
    if (length) errors.name = length;
  }

  if (!abn.ok) errors.abn = "Enter an 11-digit ABN.";

  const addressLength = lengthError(address, 300);
  if (addressLength) errors.address = addressLength;

  const phoneLength = lengthError(phone, 40);
  if (phoneLength) errors.phone = phoneLength;

  if (!email.ok) errors.email = "Enter a valid email address.";
  if (!website.ok) errors.website = "Enter a valid website link.";
  if (!categoryId) errors.categoryId = "Choose a category.";

  if (Object.keys(errors).length > 0 || !abn.ok || !email.ok || !website.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      abn: abn.abn,
      address: address || null,
      phone: phone || null,
      email: email.email,
      website: website.website,
      categoryId,
    },
  };
}

export function parseContactForm(
  formData: FormData,
): { ok: true; value: ContactInput } | { ok: false; errors: Partial<Record<ContactField, string>> } {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = stringValue(formData, "name");
  const title = stringValue(formData, "title");
  const phone = stringValue(formData, "phone");
  const mobile = stringValue(formData, "mobile");
  const email = normalizeEmail(stringValue(formData, "email"));

  if (!name) errors.name = "Enter a name.";
  else {
    const length = lengthError(name, 120);
    if (length) errors.name = length;
  }

  const titleLength = lengthError(title, 80);
  if (titleLength) errors.title = titleLength;
  const phoneLength = lengthError(phone, 40);
  if (phoneLength) errors.phone = phoneLength;
  const mobileLength = lengthError(mobile, 40);
  if (mobileLength) errors.mobile = mobileLength;
  if (!email.ok) errors.email = "Enter a valid email address.";

  if (Object.keys(errors).length > 0 || !email.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      title: title || null,
      phone: phone || null,
      mobile: mobile || null,
      email: email.email,
    },
  };
}

export function parseInsuranceForm(
  formData: FormData,
): { ok: true; value: InsuranceInput } | { ok: false; errors: Partial<Record<InsuranceField, string>> } {
  const errors: Partial<Record<InsuranceField, string>> = {};
  const type = stringValue(formData, "type");
  const policyNumber = stringValue(formData, "policyNumber");
  const insurer = stringValue(formData, "insurer");
  const expiresRaw = stringValue(formData, "expiresOn");

  if (!type) errors.type = "Enter an insurance type.";
  else {
    const length = lengthError(type, 80);
    if (length) errors.type = length;
  }

  const policyLength = lengthError(policyNumber, 80);
  if (policyLength) errors.policyNumber = policyLength;
  const insurerLength = lengthError(insurer, 120);
  if (insurerLength) errors.insurer = insurerLength;

  const expiresOn = parseDateOnly(expiresRaw);
  if (!expiresRaw) errors.expiresOn = "Enter an expiry date.";
  else if (!expiresOn) errors.expiresOn = "Enter a valid expiry date.";

  if (Object.keys(errors).length > 0 || !expiresOn) return { ok: false, errors };

  return {
    ok: true,
    value: {
      type,
      policyNumber: policyNumber || null,
      insurer: insurer || null,
      expiresOn,
    },
  };
}

export function parseNoteForm(
  formData: FormData,
): { ok: true; value: { body: string } } | { ok: false; errors: Partial<Record<NoteField, string>> } {
  const body = stringValue(formData, "body");
  if (!body) return { ok: false, errors: { body: "Enter a note." } };
  const length = lengthError(body, 2000);
  if (length) return { ok: false, errors: { body: length } };
  return { ok: true, value: { body } };
}

export function parseDocumentName(
  value: string,
  fallback: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.trim() || fallback.trim();
  if (!name) return { ok: false, error: "Enter a document name." };
  if (name.length > 180) return { ok: false, error: "Use 180 characters or fewer." };
  return { ok: true, name };
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

// Sydney calendar day, stored as UTC midnight so expiry checks do not drift with the server zone.
export function expiredBefore(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export function isInsuranceExpired(expiresOn: Date, today = new Date()): boolean {
  return expiresOn.getTime() < expiredBefore(today).getTime();
}

export function companiesWithExpiredInsurance<T extends { insurances: { expiresOn: Date }[] }>(
  companies: T[],
  today = new Date(),
): T[] {
  return companies.filter((company) =>
    company.insurances.some((insurance) => isInsuranceExpired(insurance.expiresOn, today)),
  );
}

export function expiredInsuranceWhere(today = new Date()): {
  insurances: { some: { expiresOn: { lt: Date } } };
} {
  return { insurances: { some: { expiresOn: { lt: expiredBefore(today) } } } };
}

export function insuranceStanding(expiresOn: Date[], today = new Date()): InsuranceStanding {
  if (expiresOn.length === 0) return "none";
  const expired = companiesWithExpiredInsurance(
    [{ insurances: expiresOn.map((date) => ({ expiresOn: date })) }],
    today,
  );
  return expired.length > 0 ? "expired" : "current";
}

export function formatAbn(abn: string): string {
  if (!/^\d{11}$/.test(abn)) return abn;
  return `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8)}`;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function lengthError(value: string, max: number): string | null {
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return null;
}
