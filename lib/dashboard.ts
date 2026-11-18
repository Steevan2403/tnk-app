import { assetsWithExpiredWarranty } from "./assets";
import { overdueCases } from "./cases";
import { companiesWithExpiredInsurance, expiredBefore, formatIsoDate } from "./contractors";

export const CHART_PERIODS = [1, 3, 6, 12] as const;

export type ChartPeriod = (typeof CHART_PERIODS)[number];

export const FAILED_ITEM_DAYS = 90;

export const ACTIVITY_LIMIT = 20;

export const UPCOMING_DAYS = 7;

const TITLE_MAX = 120;
const BODY_MAX = 2000;
const LABEL_MAX = 80;
const NUMBER_MAX = 40;
const NOTES_MAX = 300;

export type CaseTypePoint = { typeId: string; typeName: string; count: number };

export type FailedInspectionItem = {
  result: string | null;
  caseId: string | null;
  completedAt: Date | null;
};

export type ActionCounts = {
  overdueCases: number;
  overdueMaintenance: number;
  expiredWarranties: number;
  expiredInsurance: number;
  failedInspections: number;
};

export type ActionCountInput = {
  cases: { dueDate: Date; status: string }[];
  overdueVisits: unknown[];
  assets: { warranties: { expiresOn: Date }[] }[];
  companies: { insurances: { expiresOn: Date }[] }[];
  failedItems: FailedInspectionItem[];
  today?: Date;
};

export type ActivityEntry = {
  id: string;
  at: Date;
  userName: string;
  action: string;
  href: string;
};

export type NoteInput = { title: string | null; body: string };

export type NumberInput = { label: string; number: string; notes: string | null };

export function parseChartPeriod(value: string): ChartPeriod {
  const period = Number(value);
  if (period === 1 || period === 3 || period === 6 || period === 12) return period;
  return 3;
}

// Start of a rolling window of whole months, on the Sydney calendar day.
export function chartPeriodStart(months: number, today = new Date()): Date {
  const day = expiredBefore(today);
  const cursor = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() - months, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(day.getUTCDate(), last)));
}

export function casesByType(
  cases: { startDate: Date; typeId: string; typeName: string }[],
  months: number,
  today = new Date(),
): CaseTypePoint[] {
  const start = chartPeriodStart(months, today).getTime();
  const end = expiredBefore(today).getTime();
  const grouped = new Map<string, CaseTypePoint>();
  for (const item of cases) {
    const time = item.startDate.getTime();
    if (time < start || time > end) continue;
    const current = grouped.get(item.typeId);
    if (current) current.count += 1;
    else grouped.set(item.typeId, { typeId: item.typeId, typeName: item.typeName, count: 1 });
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.typeName.localeCompare(b.typeName, "en"));
}

export function failedItemSinceIso(today = new Date()): string {
  return formatIsoDate(shiftDays(expiredBefore(today), -FAILED_ITEM_DAYS));
}

export function failedItemsWithoutCase<T extends FailedInspectionItem>(items: T[], today = new Date()): T[] {
  const cutoff = failedItemSinceIso(today);
  return items.filter((item) => {
    if (item.result !== "fail" || item.caseId || !item.completedAt) return false;
    return sydneyDayIso(item.completedAt) >= cutoff;
  });
}

export function actionCounts(input: ActionCountInput): ActionCounts {
  const today = input.today ?? new Date();
  return {
    overdueCases: overdueCases(input.cases, today).length,
    overdueMaintenance: input.overdueVisits.length,
    expiredWarranties: assetsWithExpiredWarranty(input.assets, today).length,
    expiredInsurance: companiesWithExpiredInsurance(input.companies, today).length,
    failedInspections: failedItemsWithoutCase(input.failedItems, today).length,
  };
}

export function isOpenCase(status: string): boolean {
  return status !== "completed" && status !== "closed";
}

export function sydneyMonthBounds(today = new Date()): { from: string; to: string } {
  const day = expiredBefore(today);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
  return { from: formatIsoDate(start), to: formatIsoDate(end) };
}

export function upcomingRange(today = new Date()): { from: string; to: string } {
  const start = expiredBefore(today);
  return { from: formatIsoDate(start), to: formatIsoDate(shiftDays(start, UPCOMING_DAYS - 1)) };
}

export function sydneyDayIso(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function sydneyDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
}

export function latestActivity(entries: ActivityEntry[], limit = ACTIVITY_LIMIT): ActivityEntry[] {
  return [...entries]
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.action.localeCompare(b.action, "en") || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function groupActivityByDay(entries: ActivityEntry[]): { iso: string; label: string; items: ActivityEntry[] }[] {
  const groups: { iso: string; label: string; items: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const iso = sydneyDayIso(entry.at);
    const last = groups[groups.length - 1];
    if (last && last.iso === iso) last.items.push(entry);
    else groups.push({ iso, label: sydneyDayLabel(entry.at), items: [entry] });
  }
  return groups;
}

export function canAddBuildingNote(role: string): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canEditBuildingNote(role: string, authorId: string, userId: string): boolean {
  return canAddBuildingNote(role) && authorId === userId;
}

export function canDeleteBuildingNote(role: string, authorId: string, userId: string): boolean {
  if (role === "admin" || role === "manager") return true;
  return role === "staff" && authorId === userId;
}

export function canManageUsefulNumbers(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export function noteSearch(value: string): string {
  return value.trim().slice(0, 120);
}

export function parseBuildingNote(
  formData: FormData,
): { ok: true; value: NoteInput } | { ok: false; errors: { title?: string; body?: string } } {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const errors: { title?: string; body?: string } = {};
  if (title.length > TITLE_MAX) errors.title = `Use ${TITLE_MAX} characters or fewer.`;
  if (!body) errors.body = "Enter a note.";
  else if (body.length > BODY_MAX) errors.body = `Use ${BODY_MAX} characters or fewer.`;
  if (errors.title || errors.body) return { ok: false, errors };
  return { ok: true, value: { title: title || null, body } };
}

export function parseUsefulNumber(
  formData: FormData,
): { ok: true; value: NumberInput } | { ok: false; errors: { label?: string; number?: string; notes?: string } } {
  const label = String(formData.get("label") ?? "").trim();
  const number = String(formData.get("number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const errors: { label?: string; number?: string; notes?: string } = {};
  if (!label) errors.label = "Enter a label.";
  else if (label.length > LABEL_MAX) errors.label = `Use ${LABEL_MAX} characters or fewer.`;
  if (!number) errors.number = "Enter a phone number.";
  else if (number.length > NUMBER_MAX || !/^[\d\s()+-]+$/.test(number) || number.replace(/\D/g, "").length < 6) {
    errors.number = "Enter a phone number, such as 02 0000 0000.";
  }
  if (notes.length > NOTES_MAX) errors.notes = `Use ${NOTES_MAX} characters or fewer.`;
  if (errors.label || errors.number || errors.notes) return { ok: false, errors };
  return { ok: true, value: { label, number, notes: notes || null } };
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
