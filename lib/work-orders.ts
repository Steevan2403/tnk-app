import { parseDateOnly } from "./contractors";

export const PAGE_SIZE = 50;

export const WORK_ORDER_STATUSES = [
  "new",
  "accepted",
  "in_progress",
  "awaiting_contractor",
  "completed",
  "cancelled",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type WorkOrderField =
  | "companyId"
  | "contactId"
  | "subject"
  | "message"
  | "attendingAt"
  | "purchaseOrderNumber"
  | "accessNotes"
  | "fileIds";

export type WorkOrderCompany = {
  id: string;
  approved: boolean;
  assigned: boolean;
  contacts: { id: string; email: string | null }[];
};

export type WorkOrderFormContext = {
  companies: WorkOrderCompany[];
  fileIds: string[];
};

export type WorkOrderInput = {
  companyId: string;
  contactId: string;
  contactEmail: string;
  subject: string;
  message: string;
  attendingAt: Date | null;
  purchaseOrderNumber: string | null;
  accessNotes: string | null;
  fileIds: string[];
};

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 8000;
const NOTE_MAX = 2000;
const PURCHASE_MAX = 80;

export function isWorkOrderStatus(value: string): value is WorkOrderStatus {
  return WORK_ORDER_STATUSES.includes(value as WorkOrderStatus);
}

export function formatWorkOrderStatus(status: string): string {
  if (status === "new") return "New";
  if (status === "accepted") return "Accepted";
  if (status === "in_progress") return "In progress";
  if (status === "awaiting_contractor") return "Awaiting contractor";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

// Excel-style letters: 1 = A, 26 = Z, 27 = AA.
export function suffixFromRank(rank: number): string {
  if (!Number.isInteger(rank) || rank < 1) throw new Error("Work order letter must start at A.");
  let n = rank;
  let suffix = "";
  while (n > 0) {
    n -= 1;
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n = Math.floor(n / 26);
  }
  return suffix;
}

export function suffixRank(suffix: string): number | null {
  if (!/^[A-Z]+$/.test(suffix)) return null;
  let rank = 0;
  for (const char of suffix) rank = rank * 26 + (char.charCodeAt(0) - 64);
  return rank;
}

export function nextWorkOrderSuffix(existing: string[]): string {
  let highest = 0;
  for (const suffix of existing) {
    const rank = suffixRank(suffix);
    if (rank != null && rank > highest) highest = rank;
  }
  return suffixFromRank(highest + 1);
}

export function workOrderNumber(caseNumber: number, suffix: string): string {
  return `${caseNumber}-${suffix}`;
}

export function workOrderPdfName(caseNumber: number, suffix: string): string {
  return `work-order-${workOrderNumber(caseNumber, suffix)}.pdf`;
}

export function defaultWorkOrderSubject(caseNumber: number, suffix: string, caseSubject: string): string {
  return `Work order ${workOrderNumber(caseNumber, suffix)}: ${caseSubject}`.slice(0, SUBJECT_MAX);
}

export function subjectForSuffix(
  subject: string,
  caseNumber: number,
  previewSuffix: string,
  suffix: string,
  caseSubject: string,
): string {
  if (subject === defaultWorkOrderSubject(caseNumber, previewSuffix, caseSubject)) {
    return defaultWorkOrderSubject(caseNumber, suffix, caseSubject);
  }
  return subject;
}

export function htmlToPlain(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function jobAreaLabel(area: string, assetNames: string[], apartmentNumber: string | null): string {
  if (area === "asset") return assetNames.length ? assetNames.join(", ") : "Asset";
  if (area === "apartment") return apartmentNumber ? `Apartment ${apartmentNumber}` : "Apartment";
  return "Not applicable";
}

export function workOrderSentSummary(number: string, companyName: string, contactName: string): string {
  return `Sent work order ${number} to ${companyName} (${contactName}).`;
}

export function workOrderEmailBody(input: {
  number: string;
  buildingName: string;
  companyName: string;
  contactName: string;
  message: string;
  pdfName: string;
  checkInUrl: string;
}): string {
  return [
    `Work order ${input.number} for ${input.buildingName}.`,
    "",
    `Contractor: ${input.companyName}`,
    `Contact: ${input.contactName}`,
    "",
    input.message.trim() || "No instructions were added.",
    "",
    `The work order is attached as ${input.pdfName}.`,
    "",
    `On-site check-in: ${input.checkInUrl}`,
  ].join("\n");
}

export function contactEmail(value: string | null | undefined): string | null {
  const email = value?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 200) return null;
  return email;
}

// A contact counts only when they belong to the chosen company and have an email.
// The company must be approved, or already assigned on the case.
export function resolveWorkOrderContact(
  companyId: string,
  contactId: string,
  companies: WorkOrderCompany[],
): { email: string } | null {
  const company = companies.find((item) => item.id === companyId);
  if (!company || (!company.approved && !company.assigned)) return null;
  const contact = company.contacts.find((item) => item.id === contactId);
  if (!contact) return null;
  const email = contactEmail(contact.email);
  if (!email) return null;
  return { email };
}

export function parseWorkOrderForm(
  formData: FormData,
  context: WorkOrderFormContext,
): { ok: true; value: WorkOrderInput } | { ok: false; errors: Partial<Record<WorkOrderField, string>> } {
  const errors: Partial<Record<WorkOrderField, string>> = {};
  const companyId = stringValue(formData, "companyId");
  const contactId = stringValue(formData, "contactId");
  const subject = stringValue(formData, "subject");
  const message = stringValue(formData, "message");
  const purchaseOrderNumber = stringValue(formData, "purchaseOrderNumber");
  const accessNotes = stringValue(formData, "accessNotes");
  const attendingRaw = stringValue(formData, "attendingAt");
  const fileIds = [...new Set(formData.getAll("fileId").map((value) => String(value).trim()).filter(Boolean))];

  const contact = companyId && contactId ? resolveWorkOrderContact(companyId, contactId, context.companies) : null;
  if (!companyId || !context.companies.some((company) => company.id === companyId && (company.approved || company.assigned))) {
    errors.companyId = "Choose a contractor.";
  }
  if (!contact) errors.contactId = "Choose a contact of that company with an email.";
  if (!subject) errors.subject = "Enter a subject.";
  else if (subject.length > SUBJECT_MAX) errors.subject = `Use ${SUBJECT_MAX} characters or fewer.`;
  if (message.length > MESSAGE_MAX) errors.message = `Use ${MESSAGE_MAX} characters or fewer.`;
  const purchaseLength = lengthError(purchaseOrderNumber, PURCHASE_MAX);
  if (purchaseLength) errors.purchaseOrderNumber = purchaseLength;
  const noteLength = lengthError(accessNotes, NOTE_MAX);
  if (noteLength) errors.accessNotes = noteLength;

  let attendingAt: Date | null = null;
  if (attendingRaw) {
    attendingAt = sydneyDateTimeToUtc(attendingRaw);
    if (!attendingAt) errors.attendingAt = "Enter a valid date and time.";
  }
  if (fileIds.some((id) => !context.fileIds.includes(id))) {
    errors.fileIds = "Choose photos and documents from this case.";
  }

  if (Object.keys(errors).length || !contact) return { ok: false, errors };
  return {
    ok: true,
    value: {
      companyId,
      contactId,
      contactEmail: contact.email,
      subject,
      message,
      attendingAt,
      purchaseOrderNumber: purchaseOrderNumber || null,
      accessNotes: accessNotes || null,
      fileIds,
    },
  };
}

export function safeWorkOrdersPath(value: string): string {
  if (/^\/work-orders(?:\?[A-Za-z0-9_%=&.+\-]{0,800})?$/.test(value)) return value;
  return "/work-orders";
}

export function sentRange(from: string, to: string): { from: Date | null; to: Date | null } {
  const start = from && parseDateOnly(from) ? sydneyDayStart(from) : null;
  const endDay = to && parseDateOnly(to) ? nextDateOnly(to) : null;
  const end = endDay ? sydneyDayStart(endDay) : null;
  return { from: start, to: end };
}

export function sydneyDateTimeToUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  if (!parseDateOnly(datePart)) return null;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timezoneOffsetMs(new Date(utcGuess), "Australia/Sydney");
  const adjusted = timezoneOffsetMs(new Date(utcGuess - offset), "Australia/Sydney");
  const result = new Date(utcGuess - adjusted);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function sydneyDayStart(dateOnly: string): Date | null {
  return sydneyDateTimeToUtc(`${dateOnly}T00:00`);
}

function nextDateOnly(dateOnly: string): string | null {
  const date = parseDateOnly(dateOnly);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function timezoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let hour = value("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return asUtc - instant.getTime();
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function lengthError(value: string, max: number): string | null {
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return null;
}
