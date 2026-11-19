import { formatStatus, isCasePriority, isCaseStatus } from "./cases";
import { expiredBefore, formatCalendarDate, formatIsoDate, parseDateOnly } from "./contractors";
import { isOpenCase, sydneyDayIso } from "./dashboard";
import { resultCounts } from "./inspections";
import {
  occurrencesBetween,
  scheduleOf,
  shownVisitStatus,
  type OccurrenceState,
  type Schedule,
  type StoredOccurrence,
} from "./maintenance";

export const SECTION_KEYS = [
  "summary",
  "cases",
  "details",
  "chart",
  "maintenance",
  "inspections",
  "jobArea",
  "photos",
  "quotes",
  "invoices",
  "documents",
  "notes",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type ReportSections = Record<SectionKey, boolean>;

export const REPORT_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "summary", label: "Summary page" },
  { key: "cases", label: "Cases table" },
  { key: "details", label: "Case detail pages" },
  { key: "chart", label: "Case chart" },
  { key: "maintenance", label: "Maintenance schedule" },
  { key: "inspections", label: "Inspections" },
  { key: "jobArea", label: "Job area" },
  { key: "photos", label: "Photos" },
  { key: "quotes", label: "Quotes" },
  { key: "invoices", label: "Invoices" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" },
];

export type ReportCase = {
  id: string;
  number: number;
  startDate: Date;
  subject: string;
  typeId: string;
  typeName: string;
  status: string;
  priority: string;
  includeInReport: boolean;
  companyIds: string[];
  assetIds: string[];
  apartmentId: string | null;
};

export type ReportSelection = {
  from: Date;
  to: Date;
  includeOpen: boolean;
  typeIds: string[];
  statuses: string[];
  companyIds: string[];
  priorities: string[];
  assetIds: string[];
  apartmentIds: string[];
  excludedIds: string[];
};

export type ReportVisit = {
  subject: string;
  occursOn: Date;
  status: "completed" | "skipped" | "overdue";
};

export type CountRow = { label: string; count: number };

export type ReportSummary = {
  opened: number;
  completed: number;
  open: number;
  byType: CountRow[];
  byStatus: CountRow[];
  maintenanceDone: number;
  maintenanceSkipped: number;
  maintenanceOverdue: number;
  inspectionRuns: number;
  inspectionPass: number;
  inspectionFail: number;
  inspectionNa: number;
  inspectionUnanswered: number;
};

const SECTION_SET = new Set<string>(SECTION_KEYS);

export function isSectionKey(value: string): value is SectionKey {
  return SECTION_SET.has(value);
}

export function defaultSections(): ReportSections {
  return {
    summary: true,
    cases: true,
    details: true,
    chart: true,
    maintenance: true,
    inspections: true,
    jobArea: true,
    photos: true,
    quotes: true,
    invoices: true,
    documents: true,
    notes: false,
  };
}

export function monthPeriod(today = new Date(), offset = 0): { from: Date; to: Date } {
  const day = expiredBefore(today);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: start, to: end };
}

export function lastQuarterPeriod(today = new Date()): { from: Date; to: Date } {
  const day = expiredBefore(today);
  const quarterStart = Math.floor(day.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(day.getUTCFullYear(), quarterStart - 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
  return { from: start, to: end };
}

export function periodLabel(from: Date, to: Date): string {
  return `${formatCalendarDate(from)} to ${formatCalendarDate(to)}`;
}

export function reportFileName(from: Date, to: Date, format: "pdf" | "xlsx"): string {
  return `management-report-${formatIsoDate(from)}-to-${formatIsoDate(to)}.${format}`;
}

// A case is in the period when it started inside the range. The open toggle also
// keeps open cases that started earlier. Closed work from before the range stays out.
export function selectReportCases<T extends ReportCase>(cases: T[], selection: ReportSelection): T[] {
  if (selection.from.getTime() > selection.to.getTime()) return [];
  const from = selection.from.getTime();
  const to = selection.to.getTime();
  const excluded = new Set(selection.excludedIds);
  return cases
    .filter((item) => {
      if (!item.includeInReport || excluded.has(item.id)) return false;
      const started = item.startDate.getTime();
      const inPeriod = started >= from && started <= to;
      const openBefore = selection.includeOpen && isOpenCase(item.status) && started < from;
      if (!inPeriod && !openBefore) return false;
      if (!matchesAny(selection.typeIds, [item.typeId])) return false;
      if (!matchesAny(selection.statuses, [item.status])) return false;
      if (!matchesAny(selection.priorities, [item.priority])) return false;
      if (!matchesAny(selection.companyIds, item.companyIds)) return false;
      if (!matchesAny(selection.assetIds, item.assetIds)) return false;
      if (!matchesAny(selection.apartmentIds, item.apartmentId ? [item.apartmentId] : [])) return false;
      return true;
    })
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
}

export function summariseReport(input: {
  cases: { startDate: Date; status: string; typeName: string }[];
  from: Date;
  to: Date;
  visits: { status: ReportVisit["status"] }[];
  runs: { items: { result: string | null }[] }[];
}): ReportSummary {
  const from = input.from.getTime();
  const to = input.to.getTime();
  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  let opened = 0;
  let completed = 0;
  let open = 0;
  for (const item of input.cases) {
    const started = item.startDate.getTime();
    if (started >= from && started <= to) opened += 1;
    if (item.status === "completed" || item.status === "closed") completed += 1;
    if (isOpenCase(item.status)) open += 1;
    byType.set(item.typeName, (byType.get(item.typeName) ?? 0) + 1);
    byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
  }
  const marks = resultCounts(input.runs.flatMap((run) => run.items));
  return {
    opened,
    completed,
    open,
    byType: rankCounts(byType),
    byStatus: [...byStatus.entries()]
      .map(([status, count]) => ({ label: formatStatus(status), count, status }))
      .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.label.localeCompare(b.label, "en"))
      .map(({ label, count }) => ({ label, count })),
    maintenanceDone: input.visits.filter((visit) => visit.status === "completed").length,
    maintenanceSkipped: input.visits.filter((visit) => visit.status === "skipped").length,
    maintenanceOverdue: input.visits.filter((visit) => visit.status === "overdue").length,
    inspectionRuns: input.runs.length,
    inspectionPass: marks.pass,
    inspectionFail: marks.fail,
    inspectionNa: marks.na,
    inspectionUnanswered: marks.unanswered,
  };
}

export function reportVisits(
  events: { subject: string; schedule: Schedule; records: StoredOccurrence[] }[],
  from: Date,
  to: Date,
  today: Date,
): ReportVisit[] {
  const visits: ReportVisit[] = [];
  for (const event of events) {
    const recorded = new Map(event.records.map((record) => [formatIsoDate(record.occursOn), record.state]));
    for (const occursOn of occurrencesBetween(event.schedule, from, to)) {
      const status = shownVisitStatus(occursOn, recorded.get(formatIsoDate(occursOn)) ?? null, today);
      if (!status || status === "upcoming") continue;
      visits.push({ subject: event.subject, occursOn, status });
    }
  }
  visits.sort((a, b) => a.occursOn.getTime() - b.occursOn.getTime() || a.subject.localeCompare(b.subject, "en"));
  return visits;
}

export function inspectionsInPeriod<T extends { status: string; completedAt: Date | null }>(
  runs: T[],
  from: Date,
  to: Date,
): T[] {
  const start = formatIsoDate(from);
  const end = formatIsoDate(to);
  return runs
    .filter((run) => {
      if (run.status !== "completed" || !run.completedAt) return false;
      const day = sydneyDayIso(run.completedAt);
      return day >= start && day <= end;
    })
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime());
}

export function maintenanceEventsForReport(
  events: {
    subject: string;
    startDate: Date;
    endDate: Date | null;
    frequency: string;
    intervalMonths: number | null;
    occurrences: { occursOn: Date; state: OccurrenceState }[];
  }[],
): { subject: string; schedule: Schedule; records: StoredOccurrence[] }[] {
  const mapped = [];
  for (const event of events) {
    const schedule = scheduleOf(event);
    if (!schedule) continue;
    mapped.push({ subject: event.subject, schedule, records: event.occurrences });
  }
  return mapped;
}

export function htmlToPlain(value: string): string {
  const text = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function optionsJson(selection: ReportSelection, sections: ReportSections): string {
  return JSON.stringify({
    from: formatIsoDate(selection.from),
    to: formatIsoDate(selection.to),
    includeOpen: selection.includeOpen,
    typeIds: selection.typeIds,
    statuses: selection.statuses,
    companyIds: selection.companyIds,
    priorities: selection.priorities,
    assetIds: selection.assetIds,
    apartmentIds: selection.apartmentIds,
    excludedIds: selection.excludedIds,
    sections,
  });
}

export function parseReportRequest(
  formData: FormData,
):
  | { ok: true; value: { selection: Omit<ReportSelection, "excludedIds">; caseIds: string[]; sections: ReportSections; format: "pdf" | "xlsx" } }
  | { ok: false; error: string } {
  const from = parseDateOnly(String(formData.get("from") ?? ""));
  const to = parseDateOnly(String(formData.get("to") ?? ""));
  if (!from || !to || from.getTime() > to.getTime()) return { ok: false, error: "Choose a start date and an end date." };
  const format = String(formData.get("format") ?? "");
  if (format !== "pdf" && format !== "xlsx") return { ok: false, error: "Choose PDF or Excel." };
  const sections = defaultSections();
  for (const key of SECTION_KEYS) sections[key] = false;
  for (const key of textList(formData, "section")) {
    if (isSectionKey(key)) sections[key] = true;
  }
  return {
    ok: true,
    value: {
      format,
      sections,
      caseIds: textList(formData, "caseId"),
      selection: {
        from,
        to,
        includeOpen: formData.get("includeOpen") === "1" || formData.get("includeOpen") === "on",
        typeIds: textList(formData, "typeId"),
        statuses: textList(formData, "status").filter(isCaseStatus),
        companyIds: textList(formData, "companyId"),
        priorities: textList(formData, "priority").filter(isCasePriority),
        assetIds: textList(formData, "assetId"),
        apartmentIds: textList(formData, "apartmentId"),
      },
    },
  };
}

export function visitStatusLabel(status: ReportVisit["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "skipped") return "Skipped";
  return "Overdue";
}

function matchesAny(filter: string[], values: string[]): boolean {
  if (filter.length === 0) return true;
  const allowed = new Set(filter);
  return values.some((value) => allowed.has(value));
}

function rankCounts(groups: Map<string, number>): CountRow[] {
  return [...groups.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));
}

function statusRank(status: string): number {
  const order = ["new", "in_progress", "awaiting_contractor", "awaiting_quote", "awaiting_invoice", "completed", "closed"];
  const index = order.indexOf(status);
  return index === -1 ? order.length : index;
}

function textList(formData: FormData, key: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of formData.getAll(key)) {
    const value = String(entry).trim();
    if (!value || value.length > 80 || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
    if (values.length >= 200) break;
  }
  return values;
}
