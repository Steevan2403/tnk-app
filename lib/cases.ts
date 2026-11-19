import { expiredBefore, formatIsoDate, parseDateOnly } from "./contractors";

export { formatCalendarDate, formatDateTime, formatIsoDate } from "./contractors";

export const PAGE_SIZE = 50;

export const FIRST_CASE_NUMBER = 300;

export const CASE_PRIORITIES = ["urgent", "high", "medium", "low"] as const;

export const CASE_STATUSES = [
  "new",
  "in_progress",
  "awaiting_contractor",
  "awaiting_quote",
  "awaiting_invoice",
  "completed",
  "closed",
] as const;

export const CASE_AREAS = ["asset", "apartment", "none"] as const;

export const CASE_FILE_KINDS = ["photo", "video", "quote", "invoice", "document"] as const;

export const CASE_SORTS = ["number", "start", "subject", "type", "priority", "status"] as const;

export type CasePriority = (typeof CASE_PRIORITIES)[number];

export type CaseStatus = (typeof CASE_STATUSES)[number];

export type CaseArea = (typeof CASE_AREAS)[number];

export type CaseFileKind = (typeof CASE_FILE_KINDS)[number];

export type CaseSort = (typeof CASE_SORTS)[number];

export type CaseField =
  | "typeId"
  | "purchaseOrderNumber"
  | "startDate"
  | "dueDate"
  | "priority"
  | "status"
  | "area"
  | "assetIds"
  | "apartmentId"
  | "companyIds"
  | "contactIds"
  | "subject"
  | "description"
  | "internalNotes";

export type CaseInput = {
  typeId: string;
  purchaseOrderNumber: string | null;
  startDate: Date;
  dueDate: Date;
  priority: CasePriority;
  status: CaseStatus;
  area: CaseArea;
  assetIds: string[];
  apartmentId: string | null;
  companyIds: string[];
  contactIds: string[];
  subject: string;
  description: string;
  internalNotes: string | null;
  includeInReport: boolean;
};

export type CaseFormContext = {
  typeIds: string[];
  assetIds: string[];
  apartmentIds: string[];
  companies: { id: string; contactIds: string[] }[];
};

export type CaseActivityEntry = {
  kind: "created" | "status_changed" | "field_changed" | "file_added" | "comment_added" | "work_order_sent";
  summary: string;
};

export type CaseSnapshot = {
  typeId: string;
  purchaseOrderNumber: string | null;
  startDate: string;
  dueDate: string;
  priority: string;
  subject: string;
  descriptionHtml: string;
  internalNotes: string | null;
  includeInReport: boolean;
  area: string;
  apartmentId: string | null;
  assetIds: string[];
  companyIds: string[];
  contactIds: string[];
};

export type CaseSortable = {
  number: number;
  startDate: Date;
  subject: string;
  typeName: string;
  priority: CasePriority;
  status: CaseStatus;
};

export type CaseListQuery = {
  buildingId: string;
  userId: string;
  q: string;
  typeId: string;
  priority: string;
  status: string;
  companyId: string;
  from: Date | null;
  to: Date | null;
  starred: boolean;
  overdue: boolean;
  sort: CaseSort;
  dir: "asc" | "desc";
  page: number;
};

const PRIORITY_RANK: Record<CasePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const STATUS_RANK: Record<CaseStatus, number> = {
  new: 0,
  in_progress: 1,
  awaiting_contractor: 2,
  awaiting_quote: 3,
  awaiting_invoice: 4,
  completed: 5,
  closed: 6,
};

const FIELD_LABELS: { key: keyof CaseSnapshot; label: string }[] = [
  { key: "typeId", label: "case type" },
  { key: "purchaseOrderNumber", label: "purchase order" },
  { key: "startDate", label: "start date" },
  { key: "dueDate", label: "due date" },
  { key: "priority", label: "priority" },
  { key: "subject", label: "subject" },
  { key: "descriptionHtml", label: "description" },
  { key: "internalNotes", label: "internal notes" },
  { key: "includeInReport", label: "management report" },
  { key: "area", label: "job area" },
  { key: "apartmentId", label: "apartment" },
  { key: "assetIds", label: "assets" },
  { key: "companyIds", label: "contractors" },
  { key: "contactIds", label: "contacts" },
];

const DUE_BEFORE_START = "Due date cannot be before the start date.";
const CONTACT_COMPANY = "Choose contacts from the selected companies.";

export function parsePage(value: string): number {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) return 1;
  if (page > 10000) return 10000;
  return page;
}

export function parseCaseNumber(value: string): number | null {
  if (!/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

export function parseCaseSort(value: string): CaseSort {
  return CASE_SORTS.includes(value as CaseSort) ? (value as CaseSort) : "number";
}

export function parseSortDir(value: string): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

export function isCasePriority(value: string): value is CasePriority {
  return CASE_PRIORITIES.includes(value as CasePriority);
}

export function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus);
}

export function isCaseArea(value: string): value is CaseArea {
  return CASE_AREAS.includes(value as CaseArea);
}

export function isCaseFileKind(value: string): value is CaseFileKind {
  return CASE_FILE_KINDS.includes(value as CaseFileKind);
}

export function formatPriority(priority: string): string {
  if (priority === "urgent") return "Urgent";
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  if (priority === "low") return "Low";
  return priority;
}

export function formatStatus(status: string): string {
  if (status === "new") return "New";
  if (status === "in_progress") return "In progress";
  if (status === "awaiting_contractor") return "Awaiting contractor";
  if (status === "awaiting_quote") return "Awaiting quote";
  if (status === "awaiting_invoice") return "Awaiting invoice";
  if (status === "completed") return "Completed";
  if (status === "closed") return "Closed";
  return status;
}

export function formatArea(area: string): string {
  if (area === "asset") return "Asset";
  if (area === "apartment") return "Apartment";
  return "Not applicable";
}

export function fileKindLabel(kind: string): string {
  if (kind === "photo") return "photo";
  if (kind === "video") return "video";
  if (kind === "quote") return "quote";
  if (kind === "invoice") return "invoice";
  if (kind === "document") return "document";
  return "file";
}

export function defaultCaseDates(now = new Date()): { startDate: string; dueDate: string } {
  const start = expiredBefore(now);
  const due = new Date(start.getTime());
  due.setUTCDate(due.getUTCDate() + 7);
  return { startDate: formatIsoDate(start), dueDate: formatIsoDate(due) };
}

export function nextCaseNumber(usedNumbers: number[]): number {
  let highest = 0;
  for (const number of usedNumbers) {
    if (Number.isInteger(number) && number > highest) highest = number;
  }
  return Math.max(highest + 1, FIRST_CASE_NUMBER);
}

export function contactCompanyError(
  companyIds: string[],
  contactIds: string[],
  companies: { id: string; contactIds: string[] }[],
): string | null {
  const allowed = new Set<string>();
  for (const companyId of companyIds) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return "Choose an approved contractor.";
    for (const contactId of company.contactIds) allowed.add(contactId);
  }
  if (contactIds.some((contactId) => !allowed.has(contactId))) return CONTACT_COMPANY;
  return null;
}

export function isCaseOverdue(item: { dueDate: Date; status: string }, today = new Date()): boolean {
  if (item.status === "completed" || item.status === "closed") return false;
  return item.dueDate.getTime() < expiredBefore(today).getTime();
}

export function overdueCases<T extends { dueDate: Date; status: string }>(cases: T[], today = new Date()): T[] {
  return cases.filter((item) => isCaseOverdue(item, today));
}

export function overdueCaseWhere(today = new Date()): {
  dueDate: { lt: Date };
  status: { notIn: Array<"completed" | "closed"> };
} {
  return {
    dueDate: { lt: expiredBefore(today) },
    status: { notIn: ["completed", "closed"] },
  };
}

export function statusChange(input: {
  from: string;
  to: string;
  completedAt: Date | null;
  now: Date;
}): { status: CaseStatus; completedAt: Date | null; activity: CaseActivityEntry | null } | null {
  if (!isCaseStatus(input.to)) return null;
  const done = input.to === "completed" || input.to === "closed";
  const completedAt = done ? (input.completedAt ?? input.now) : null;
  if (input.from === input.to) return { status: input.to, completedAt, activity: null };
  return {
    status: input.to,
    completedAt,
    activity: {
      kind: "status_changed",
      summary: `Status changed from ${formatStatus(input.from)} to ${formatStatus(input.to)}.`,
    },
  };
}

export function changedFieldLabels(before: CaseSnapshot, after: CaseSnapshot): string[] {
  return FIELD_LABELS.filter((field) => snapshotValue(before[field.key]) !== snapshotValue(after[field.key])).map(
    (field) => field.label,
  );
}

export function fieldChangeActivity(labels: string[]): CaseActivityEntry | null {
  if (labels.length === 0) return null;
  return { kind: "field_changed", summary: `Updated ${labels.join(", ")}.` };
}

export function caseCreatedActivity(): CaseActivityEntry {
  return { kind: "created", summary: "Case created." };
}

export function fileAddedActivity(kind: string, name: string): CaseActivityEntry {
  return { kind: "file_added", summary: `Added ${fileKindLabel(kind)} ${name}.` };
}

export function commentAddedActivity(): CaseActivityEntry {
  return { kind: "comment_added", summary: "Added a comment." };
}

export function compareCases(a: CaseSortable, b: CaseSortable, sort: CaseSort, dir: "asc" | "desc"): number {
  let result = 0;
  if (sort === "number") result = a.number - b.number;
  else if (sort === "start") result = a.startDate.getTime() - b.startDate.getTime() || a.number - b.number;
  else if (sort === "subject") result = a.subject.localeCompare(b.subject, "en") || a.number - b.number;
  else if (sort === "type") result = a.typeName.localeCompare(b.typeName, "en") || a.number - b.number;
  else if (sort === "priority") result = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.number - b.number;
  else result = STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.number - b.number;
  return dir === "desc" ? -result : result;
}

export function parseCaseTypeName(value: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.trim();
  if (!name) return { ok: false, error: "Enter a case type name." };
  if (name.length > 80) return { ok: false, error: "Use 80 characters or fewer." };
  return { ok: true, name };
}

export function parseComment(value: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = value.trim();
  if (!body) return { ok: false, error: "Enter a comment." };
  if (body.length > 2000) return { ok: false, error: "Use 2000 characters or fewer." };
  return { ok: true, body };
}

export function safeCasesPath(value: string): string {
  if (/^\/cases(?:\/[1-9]\d{0,8})?(?:\/edit)?(?:\?[A-Za-z0-9_%=&.+\-]{0,800})?$/.test(value)) return value;
  return "/cases";
}

export function parseCaseForm(
  formData: FormData,
  context: CaseFormContext,
): { ok: true; value: CaseInput } | { ok: false; errors: Partial<Record<CaseField, string>> } {
  const errors: Partial<Record<CaseField, string>> = {};
  const typeId = stringValue(formData, "typeId");
  const purchaseOrderNumber = stringValue(formData, "purchaseOrderNumber");
  const subject = stringValue(formData, "subject");
  const description = stringValue(formData, "description");
  const internalNotes = stringValue(formData, "internalNotes");
  const priorityRaw = stringValue(formData, "priority");
  const statusRaw = stringValue(formData, "status");
  const areaRaw = stringValue(formData, "area");
  const assetIds = uniqueList(formData, "assetId");
  const companyIds = uniqueList(formData, "companyId");
  const contactIds = uniqueList(formData, "contactId");
  const apartmentId = stringValue(formData, "apartmentId");

  if (!typeId || !context.typeIds.includes(typeId)) errors.typeId = "Choose a case type.";

  const purchaseLength = lengthError(purchaseOrderNumber, 80);
  if (purchaseLength) errors.purchaseOrderNumber = purchaseLength;

  const startRaw = stringValue(formData, "startDate");
  const dueRaw = stringValue(formData, "dueDate");
  const startDate = startRaw ? parseDateOnly(startRaw) : null;
  const dueDate = dueRaw ? parseDateOnly(dueRaw) : null;
  if (!startRaw) errors.startDate = "Enter a start date.";
  else if (!startDate) errors.startDate = "Enter a valid start date.";
  if (!dueRaw) errors.dueDate = "Enter a due date.";
  else if (!dueDate) errors.dueDate = "Enter a valid due date.";
  else if (startDate && dueDate.getTime() < startDate.getTime()) errors.dueDate = DUE_BEFORE_START;

  if (!isCasePriority(priorityRaw)) errors.priority = "Choose a priority.";
  if (!isCaseStatus(statusRaw)) errors.status = "Choose a status.";
  if (!isCaseArea(areaRaw)) errors.area = "Choose a job area.";

  if (areaRaw === "asset") {
    if (assetIds.length === 0) errors.assetIds = "Choose at least one asset.";
    else if (assetIds.some((id) => !context.assetIds.includes(id))) errors.assetIds = "Choose assets from this building.";
  }
  if (areaRaw === "apartment") {
    if (!apartmentId || !context.apartmentIds.includes(apartmentId)) {
      errors.apartmentId = "Choose an apartment in this building.";
    }
  }

  const companyError = contactCompanyError(companyIds, contactIds, context.companies);
  if (companyError === "Choose an approved contractor.") errors.companyIds = companyError;
  else if (companyError) errors.contactIds = companyError;

  if (!subject) errors.subject = "Enter a subject.";
  else {
    const length = lengthError(subject, 160);
    if (length) errors.subject = length;
  }

  if (description.length > 50_000) errors.description = "Use 20000 characters or fewer.";
  const notesLength = lengthError(internalNotes, 4000);
  if (notesLength) errors.internalNotes = notesLength;

  if (
    Object.keys(errors).length > 0 ||
    !startDate ||
    !dueDate ||
    !isCasePriority(priorityRaw) ||
    !isCaseStatus(statusRaw) ||
    !isCaseArea(areaRaw)
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      typeId,
      purchaseOrderNumber: purchaseOrderNumber || null,
      startDate,
      dueDate,
      priority: priorityRaw,
      status: statusRaw,
      area: areaRaw,
      assetIds: areaRaw === "asset" ? assetIds : [],
      apartmentId: areaRaw === "apartment" ? apartmentId : null,
      companyIds,
      contactIds,
      subject,
      description,
      internalNotes: internalNotes || null,
      includeInReport: formData.get("includeInReport") != null,
    },
  };
}

function snapshotValue(value: string | boolean | null | string[]): string {
  if (Array.isArray(value)) return [...value].sort().join("\n");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return value ?? "";
}

function uniqueList(formData: FormData, key: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const value of formData.getAll(key)) {
    const text = String(value).trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    values.push(text);
  }
  return values;
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function lengthError(value: string, max: number): string | null {
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return null;
}
