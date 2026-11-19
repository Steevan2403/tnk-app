import { UTCDate } from "@date-fns/utc";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { contactCompanyError, isCaseArea, type CaseArea } from "./cases";
import { expiredBefore, formatIsoDate, parseDateOnly } from "./contractors";
import { canManageMaintenance } from "./roles";

export const PAGE_SIZE = 50;

export const MAINTENANCE_TABS = ["active", "overdue", "completed"] as const;

export const FREQUENCIES = [
  "one_off",
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
  "every_n_months",
] as const;

export const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;

export const CALENDAR_KINDS = ["maintenance", "case", "work_order"] as const;

export type MaintenanceTab = (typeof MAINTENANCE_TABS)[number];

export type Frequency = (typeof FREQUENCIES)[number];

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export type OccurrenceState = "completed" | "skipped" | "removed";

export type VisitStatus = "completed" | "skipped" | "overdue" | "upcoming";

export type Schedule = {
  startDate: Date;
  endDate: Date | null;
  frequency: Frequency;
  intervalMonths: number | null;
};

export type StoredOccurrence = {
  occursOn: Date;
  state: OccurrenceState;
};

export type MaintenanceField =
  | "subject"
  | "description"
  | "notes"
  | "startDate"
  | "endDate"
  | "frequency"
  | "intervalMonths"
  | "reminderDays"
  | "area"
  | "assetIds"
  | "apartmentId"
  | "companyIds"
  | "contactIds";

export type MaintenanceInput = {
  subject: string;
  description: string;
  notes: string | null;
  startDate: Date;
  endDate: Date | null;
  frequency: Frequency;
  intervalMonths: number | null;
  remindContractor: boolean;
  reminderDays: number;
  area: CaseArea;
  assetIds: string[];
  apartmentId: string | null;
  companyIds: string[];
  contactIds: string[];
};

export type MaintenanceFormContext = {
  assetIds: string[];
  apartmentIds: string[];
  companies: { id: string; contactIds: string[] }[];
};

export type OverdueVisit = {
  eventId: string;
  subject: string;
  occursOn: Date;
};

export type DueReminder = {
  eventId: string;
  occursOn: string;
  to: string[];
  subject: string;
  body: string;
};

export type CaseDraft = {
  typeId: string;
  startDate: string;
  dueDate: string;
  area: CaseArea;
  assetIds: string[];
  apartmentId: string;
  companyIds: string[];
  contactIds: string[];
  subject: string;
  descriptionHtml: string;
  internalNotes: string;
};

const MONTH_STEPS: Partial<Record<Frequency, number>> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

const DAY_STEPS: Partial<Record<Frequency, number>> = {
  weekly: 7,
  fortnightly: 14,
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_off: "One-off",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
  every_n_months: "Every N months",
};

// Dates are civil days stored at UTC midnight. Arithmetic uses UTC so a
// Sydney daylight-saving change cannot shift the calendar day.
export function sydneyToday(now = new Date()): Date {
  return expiredBefore(now);
}

export function isFrequency(value: string): value is Frequency {
  return FREQUENCIES.includes(value as Frequency);
}

export function isMaintenanceTab(value: string): value is MaintenanceTab {
  return MAINTENANCE_TABS.includes(value as MaintenanceTab);
}

export function isCalendarView(value: string): value is CalendarView {
  return CALENDAR_VIEWS.includes(value as CalendarView);
}

export function isCalendarKind(value: string): value is CalendarKind {
  return CALENDAR_KINDS.includes(value as CalendarKind);
}

export function formatFrequency(frequency: string, intervalMonths: number | null): string {
  if (frequency === "every_n_months" && intervalMonths && intervalMonths > 0) {
    return `Every ${intervalMonths} months`;
  }
  if (isFrequency(frequency)) return FREQUENCY_LABELS[frequency];
  return frequency;
}

export function formatVisitStatus(status: VisitStatus): string {
  if (status === "completed") return "Completed";
  if (status === "skipped") return "Skipped";
  if (status === "overdue") return "Overdue";
  return "Upcoming";
}

export function scheduleOf(event: {
  startDate: Date;
  endDate: Date | null;
  frequency: string;
  intervalMonths: number | null;
}): Schedule | null {
  if (!isFrequency(event.frequency)) return null;
  return {
    startDate: event.startDate,
    endDate: event.endDate,
    frequency: event.frequency,
    intervalMonths: event.intervalMonths,
  };
}

export function occurrencesBetween(schedule: Schedule, windowStart: Date, windowEnd: Date): Date[] {
  const start = utc(schedule.startDate);
  const from = utc(windowStart);
  let until = utc(windowEnd);
  if (schedule.endDate) {
    const end = utc(schedule.endDate);
    if (end < until) until = end;
  }
  if (until < start || until < from) return [];

  if (schedule.frequency === "one_off") {
    return start >= from && start <= until ? [plain(start)] : [];
  }

  const monthStep = schedule.frequency === "every_n_months" ? schedule.intervalMonths : MONTH_STEPS[schedule.frequency];
  const dayStep = DAY_STEPS[schedule.frequency];
  if (dayStep) return stepDays(start, from, until, dayStep);
  if (monthStep == null || !Number.isInteger(monthStep) || monthStep < 1) return [];
  return stepMonths(start, from, until, monthStep);
}

export function isOccurrenceDate(schedule: Schedule, date: Date): boolean {
  const day = plain(utc(date));
  return occurrencesBetween(schedule, day, day).some((item) => item.getTime() === day.getTime());
}

export function visitStatus(date: Date, state: OccurrenceState | null, today: Date): VisitStatus {
  if (state === "completed" || state === "skipped") return state;
  return date.getTime() < utc(today).getTime() ? "overdue" : "upcoming";
}

// A removed visit is not shown. Callers skip that date instead of marking it overdue.
export function shownVisitStatus(date: Date, state: OccurrenceState | null, today: Date): VisitStatus | null {
  if (state === "removed") return null;
  return visitStatus(date, state, today);
}

export function asOccurrenceState(state: string): OccurrenceState {
  if (state === "skipped" || state === "removed") return state;
  return "completed";
}

export function planMaintenanceDelete(input: {
  role: string;
  frequency: string;
  scope: string;
}): { ok: true; action: "occurrence" | "series" } | { ok: false; error: string } {
  if (!canManageMaintenance(input.role)) {
    return { ok: false, error: "You do not have permission to delete maintenance." };
  }
  if (!isFrequency(input.frequency)) return { ok: false, error: "That maintenance event could not be found." };
  if (input.scope === "occurrence" && input.frequency !== "one_off") return { ok: true, action: "occurrence" };
  if (input.scope === "series" || input.scope === "occurrence") return { ok: true, action: "series" };
  return { ok: false, error: "Choose this visit or the whole series." };
}

export function maintenanceDeletePrompt(input: {
  subject: string;
  dateLabel: string;
  recurring: boolean;
  visitCases: number;
  seriesCases: number;
  fileCount: number;
}): { title: string; message: string } {
  const title = `Delete ${input.subject}?`;
  if (!input.recurring) {
    return {
      title,
      message: `Delete this event on ${input.dateLabel}?\nThe event, its visit history, and its reminders are removed. ${fileSentence(input.fileCount)} ${caseSentence(input.seriesCases, "from it")}`,
    };
  }
  return {
    title,
    message: [
      `This visit is ${input.dateLabel}. Choose this visit only, or the whole series.`,
      `This visit only: that date comes off the calendar. The other visits stay. ${caseSentence(input.visitCases, "from this visit")}`,
      `Whole series: the schedule, visit history, and reminders are removed. ${fileSentence(input.fileCount)} ${caseSentence(input.seriesCases, "from this series")}`,
    ].join("\n"),
  };
}

export function seriesDeletePrompt(input: {
  subject: string;
  recurring: boolean;
  seriesCases: number;
  fileCount: number;
}): { title: string; message: string } {
  const lead = input.recurring ? "Delete every visit in this series?" : "Delete this event?";
  return {
    title: `Delete ${input.subject}?`,
    message: `${lead}\nThe schedule, visit history, and reminders are removed. ${fileSentence(input.fileCount)} ${caseSentence(input.seriesCases, "from it")}`,
  };
}

export function removedVisitActivity(subject: string, dateLabel: string): string {
  return `Deleted the ${dateLabel} visit of ${subject}. Other visits were kept.`;
}

export function seriesDeletedActivity(subject: string, caseCount: number): string {
  if (caseCount === 0) return `Deleted maintenance event ${subject}. No cases had been opened from it.`;
  if (caseCount === 1) {
    return `Deleted maintenance event ${subject}. 1 case already opened from it was kept, including its work orders.`;
  }
  return `Deleted maintenance event ${subject}. ${caseCount} cases already opened from it were kept, including their work orders.`;
}

function fileSentence(count: number): string {
  if (count === 0) return "It has no files.";
  if (count === 1) return "1 file is removed.";
  return `${count} files are removed.`;
}

function caseSentence(count: number, source: string): string {
  if (count === 0) return `No cases were opened ${source}.`;
  if (count === 1) return `1 case already opened ${source} stays, including its work orders.`;
  return `${count} cases already opened ${source} stay, including their work orders.`;
}

// Overdue visits are before today in Sydney, not completed or skipped, and inside the last 12 months.
export function overdueDates(schedule: Schedule, records: StoredOccurrence[], today: Date): Date[] {
  const todayUtc = utc(today);
  const from = plain(addMonths(todayUtc, -12));
  const to = plain(addDays(todayUtc, -1));
  const done = doneKeys(records);
  return occurrencesBetween(schedule, from, to).filter((date) => !done.has(formatIsoDate(date)));
}

export function overdueMaintenance(
  events: { id: string; subject: string; schedule: Schedule; records: StoredOccurrence[] }[],
  today: Date,
): OverdueVisit[] {
  const visits: OverdueVisit[] = [];
  for (const event of events) {
    for (const occursOn of overdueDates(event.schedule, event.records, today)) {
      visits.push({ eventId: event.id, subject: event.subject, occursOn });
    }
  }
  visits.sort((a, b) => a.occursOn.getTime() - b.occursOn.getTime() || a.subject.localeCompare(b.subject, "en"));
  return visits;
}

export function nextDueDate(schedule: Schedule, records: StoredOccurrence[], today: Date): Date | null {
  const todayUtc = utc(today);
  const from = schedule.startDate.getTime() > todayUtc.getTime() ? schedule.startDate : plain(todayUtc);
  const horizon = plain(addMonths(todayUtc, 36));
  const done = doneKeys(records);
  return occurrencesBetween(schedule, from, horizon).find((date) => !done.has(formatIsoDate(date))) ?? null;
}

export function isScheduleComplete(schedule: Schedule, records: StoredOccurrence[], today: Date): boolean {
  const end = schedule.endDate ?? (schedule.frequency === "one_off" ? schedule.startDate : null);
  if (!end || utc(end).getTime() >= utc(today).getTime()) return false;
  const dates = occurrencesBetween(schedule, schedule.startDate, end);
  if (dates.length === 0) return false;
  const done = doneKeys(records);
  return dates.every((date) => done.has(formatIsoDate(date)));
}

export function maintenanceTab(schedule: Schedule, records: StoredOccurrence[], today: Date): MaintenanceTab {
  if (isScheduleComplete(schedule, records, today)) return "completed";
  if (overdueDates(schedule, records, today).length > 0) return "overdue";
  return "active";
}

export function reminderRecipients(contactEmails: (string | null)[], companyEmails: (string | null)[]): string[] {
  const contacts = cleanEmails(contactEmails);
  return contacts.length > 0 ? contacts : cleanEmails(companyEmails);
}

export function dueReminders(
  events: {
    id: string;
    subject: string;
    buildingName: string;
    description: string;
    reminderDays: number;
    remindContractor: boolean;
    schedule: Schedule;
    records: StoredOccurrence[];
    emails: string[];
  }[],
  sent: { eventId: string; occursOn: string }[],
  today: Date,
): DueReminder[] {
  const seen = new Set(sent.map((item) => `${item.eventId}|${item.occursOn}`));
  const due: DueReminder[] = [];
  for (const event of events) {
    if (!event.remindContractor || event.reminderDays < 0) continue;
    const emails = cleanEmails(event.emails);
    if (emails.length === 0) continue;
    const target = plain(addDays(utc(today), event.reminderDays));
    const done = doneKeys(event.records);
    for (const occursOn of occurrencesBetween(event.schedule, target, target)) {
      const key = formatIsoDate(occursOn);
      if (done.has(key)) continue;
      const id = `${event.id}|${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      due.push({
        eventId: event.id,
        occursOn: key,
        to: emails,
        subject: `Maintenance reminder: ${event.subject}`,
        body: [
          `Maintenance is due at ${event.buildingName}.`,
          "",
          event.subject,
          `Due on ${key}.`,
          ...(event.description.trim() ? ["", event.description.trim()] : []),
          "",
          "TNK Property Services",
        ].join("\n"),
      });
    }
  }
  return due;
}

export function caseDraftFromOccurrence(
  event: {
    subject: string;
    description: string;
    notes: string | null;
    area: CaseArea;
    assetIds: string[];
    apartmentId: string | null;
    companyIds: string[];
    contactIds: string[];
  },
  occursOn: string,
  typeId: string,
): CaseDraft {
  return {
    typeId,
    startDate: occursOn,
    dueDate: occursOn,
    area: event.area,
    assetIds: event.area === "asset" ? [...event.assetIds] : [],
    apartmentId: event.area === "apartment" ? (event.apartmentId ?? "") : "",
    companyIds: [...event.companyIds],
    contactIds: [...event.contactIds],
    subject: event.subject,
    descriptionHtml: plainTextToCaseHtml(event.description),
    internalNotes: event.notes ?? "",
  };
}

export function plainTextToCaseHtml(value: string): string {
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (!escaped.trim()) return "";
  return escaped
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function parseMaintenanceForm(
  formData: FormData,
  context: MaintenanceFormContext,
): { ok: true; value: MaintenanceInput } | { ok: false; errors: Partial<Record<MaintenanceField, string>> } {
  const errors: Partial<Record<MaintenanceField, string>> = {};
  const subject = stringValue(formData, "subject");
  const description = stringValue(formData, "description");
  const notes = stringValue(formData, "notes");
  const frequencyRaw = stringValue(formData, "frequency");
  const areaRaw = stringValue(formData, "area");
  const assetIds = uniqueList(formData, "assetId");
  const companyIds = uniqueList(formData, "companyId");
  const contactIds = uniqueList(formData, "contactId");
  const apartmentId = stringValue(formData, "apartmentId");
  const noEnd = formData.get("noEnd") != null;
  const remind = formData.get("remindContractor") != null;

  if (!subject) errors.subject = "Enter a subject.";
  else {
    const length = lengthError(subject, 160);
    if (length) errors.subject = length;
  }
  const descriptionLength = lengthError(description, 4000);
  if (descriptionLength) errors.description = descriptionLength;
  const notesLength = lengthError(notes, 4000);
  if (notesLength) errors.notes = notesLength;

  const startRaw = stringValue(formData, "startDate");
  const startDate = startRaw ? parseDateOnly(startRaw) : null;
  if (!startRaw) errors.startDate = "Enter a start date.";
  else if (!startDate) errors.startDate = "Enter a valid start date.";

  let endDate: Date | null = null;
  if (!noEnd) {
    const endRaw = stringValue(formData, "endDate");
    endDate = endRaw ? parseDateOnly(endRaw) : null;
    if (!endRaw) errors.endDate = "Enter an end date, or choose no end date.";
    else if (!endDate) errors.endDate = "Enter a valid end date.";
    else if (startDate && endDate.getTime() <= startDate.getTime()) {
      errors.endDate = "End date must be after the start date.";
    }
  }

  if (!isFrequency(frequencyRaw)) errors.frequency = "Choose a frequency.";
  let intervalMonths: number | null = null;
  if (frequencyRaw === "every_n_months") {
    const raw = stringValue(formData, "intervalMonths");
    const months = Number(raw);
    if (!/^\d{1,2}$/.test(raw) || !Number.isInteger(months) || months < 1 || months > 36) {
      errors.intervalMonths = "Enter a number of months from 1 to 36.";
    } else intervalMonths = months;
  }

  let reminderDays = 7;
  if (remind) {
    const raw = stringValue(formData, "reminderDays") || "7";
    const days = Number(raw);
    if (!/^\d{1,2}$/.test(raw) || !Number.isInteger(days) || days < 0 || days > 90) {
      errors.reminderDays = "Enter a number of days from 0 to 90.";
    } else reminderDays = days;
  }

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

  if (
    Object.keys(errors).length > 0 ||
    !startDate ||
    !isFrequency(frequencyRaw) ||
    !isCaseArea(areaRaw) ||
    (frequencyRaw === "every_n_months" && intervalMonths == null)
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      subject,
      description,
      notes: notes || null,
      startDate,
      endDate,
      frequency: frequencyRaw,
      intervalMonths,
      remindContractor: remind,
      reminderDays,
      area: areaRaw,
      assetIds: areaRaw === "asset" ? assetIds : [],
      apartmentId: areaRaw === "apartment" ? apartmentId : null,
      companyIds,
      contactIds,
    },
  };
}

export function monthCells(anchorIso: string): { iso: string; inMonth: boolean }[] {
  const anchor = utcFromIso(anchorIso);
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    cells.push({ iso: format(date, "yyyy-MM-dd"), inMonth: date.getMonth() === monthStart.getMonth() });
  }
  return cells;
}

export function weekCells(anchorIso: string): string[] {
  const start = startOfWeek(utcFromIso(anchorIso), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), "yyyy-MM-dd"));
}

export function monthDates(anchorIso: string): string[] {
  return monthCells(anchorIso)
    .filter((cell) => cell.inMonth)
    .map((cell) => cell.iso);
}

export function shiftCalendar(view: CalendarView, anchorIso: string, direction: -1 | 1): string {
  const anchor = utcFromIso(anchorIso);
  if (view === "week") return format(addDays(anchor, direction * 7), "yyyy-MM-dd");
  return format(addMonths(anchor, direction), "yyyy-MM-dd");
}

export function calendarTitle(view: CalendarView, anchorIso: string): string {
  const anchor = utcFromIso(anchorIso);
  if (view === "week") {
    const days = weekCells(anchorIso);
    return `${format(utcFromIso(days[0]), "d MMM")} – ${format(utcFromIso(days[6]), "d MMM yyyy")}`;
  }
  return format(anchor, "MMMM yyyy");
}

export function timelineMonths(today: Date): { key: string; label: string }[] {
  const start = startOfMonth(utc(today));
  return Array.from({ length: 12 }, (_, index) => {
    const date = addMonths(start, index);
    return { key: format(date, "yyyy-MM"), label: format(date, "MMM yyyy") };
  });
}

export function safeCalendarPath(value: string): string {
  if (value === "/calendar") return value;
  if (/^\/calendar\?[A-Za-z0-9_%=&.+\-]{1,800}$/.test(value)) return value;
  return "/calendar";
}

function stepDays(start: UTCDate, from: UTCDate, until: UTCDate, step: number): Date[] {
  const dates: Date[] = [];
  const diff = differenceInCalendarDays(from, start);
  let index = diff <= 0 ? 0 : Math.ceil(diff / step);
  for (let guard = 0; guard < 2000; guard += 1) {
    const next = addDays(start, index * step);
    if (next > until) break;
    if (next >= from) dates.push(plain(next));
    index += 1;
  }
  return dates;
}

function stepMonths(start: UTCDate, from: UTCDate, until: UTCDate, step: number): Date[] {
  const dates: Date[] = [];
  const diff = differenceInCalendarMonths(from, start);
  let index = diff <= 0 ? 0 : Math.floor(diff / step) - 1;
  if (index < 0) index = 0;
  for (let guard = 0; guard < 2000; guard += 1) {
    const next = addMonths(start, index * step);
    if (next > until) break;
    if (next >= from && next >= start) dates.push(plain(next));
    index += 1;
  }
  return dates;
}

function doneKeys(records: StoredOccurrence[]): Set<string> {
  return new Set(records.map((record) => formatIsoDate(record.occursOn)));
}

function utc(date: Date): UTCDate {
  return new UTCDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function utcFromIso(iso: string): UTCDate {
  const date = parseDateOnly(iso) ?? new Date(Date.UTC(1970, 0, 1));
  return utc(date);
}

function plain(date: Date): Date {
  const value = date instanceof UTCDate ? date : utc(date);
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function cleanEmails(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const value of values) {
    const email = value?.trim().toLowerCase() ?? "";
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
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
