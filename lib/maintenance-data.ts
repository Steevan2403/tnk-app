import type { Prisma } from "@prisma/client";
import { formatCalendarDate, formatIsoDate, parseDateOnly } from "./contractors";
import { prisma } from "./db";
import {
  PAGE_SIZE,
  asOccurrenceState,
  caseDraftFromOccurrence,
  isFrequency,
  isOccurrenceDate,
  maintenanceTab,
  nextDueDate,
  monthDates,
  occurrencesBetween,
  overdueMaintenance,
  scheduleOf,
  shownVisitStatus,
  sydneyToday,
  visitStatus,
  weekCells,
  type CalendarKind,
  type CaseDraft,
  type MaintenanceTab,
  type StoredOccurrence,
  type VisitStatus,
} from "./maintenance";
import { sydneyDayStart, workOrderNumber } from "./work-orders";

const eventInclude = {
  apartment: { select: { id: true, number: true } },
  assets: {
    include: { asset: { select: { id: true, name: true, categoryId: true, category: { select: { name: true } } } } },
  },
  companies: { include: { company: { select: { id: true, name: true, email: true } } } },
  contacts: { include: { contact: { select: { id: true, name: true, email: true } } } },
  files: { orderBy: { uploadedAt: "desc" as const }, select: { id: true, name: true, kind: true } },
  occurrences: { include: { actedBy: { select: { name: true } } } },
} satisfies Prisma.MaintenanceEventInclude;

export type MaintenanceRecord = Prisma.MaintenanceEventGetPayload<{ include: typeof eventInclude }>;

export type MaintenanceRow = {
  id: string;
  subject: string;
  startDate: Date;
  endDate: Date | null;
  frequency: string;
  intervalMonths: number | null;
  companyNames: string[];
  assetNames: string[];
  documentCount: number;
  remindContractor: boolean;
  nextDue: Date | null;
  upcomingDates: string[];
  tab: MaintenanceTab;
};

export type MaintenanceListQuery = {
  q: string;
  tab: MaintenanceTab;
  frequency: string;
  companyId: string;
  categoryId: string;
  page: number;
};

export async function listMaintenance(
  buildingId: string,
  query: MaintenanceListQuery,
  now = new Date(),
): Promise<{ total: number; rows: MaintenanceRow[] }> {
  const today = sydneyToday(now);
  const events = await prisma.maintenanceEvent.findMany({
    where: {
      buildingId,
      ...(isFrequency(query.frequency) ? { frequency: query.frequency } : {}),
      ...(query.q
        ? { OR: [{ subject: { contains: query.q } }, { description: { contains: query.q } }] }
        : {}),
      ...(query.companyId ? { companies: { some: { companyId: query.companyId } } } : {}),
      ...(query.categoryId ? { assets: { some: { asset: { categoryId: query.categoryId } } } } : {}),
    },
    include: eventInclude,
    orderBy: { subject: "asc" },
  });

  const months = timelineKeys(today);
  const rows = events
    .map((event) => toRow(event, today, months))
    .filter((row) => row.tab === query.tab)
    .sort((a, b) => compareRows(a, b, query.tab));
  const start = (query.page - 1) * PAGE_SIZE;
  return { total: rows.length, rows: rows.slice(start, start + PAGE_SIZE) };
}

export async function maintenanceFilterOptions(buildingId: string) {
  const [categories, companies] = await Promise.all([
    prisma.assetCategory.findMany({
      where: { assets: { some: { buildingId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contractorCompany.findMany({
      where: { status: "approved" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { categories, companies };
}

export async function getMaintenance(buildingId: string, id: string): Promise<MaintenanceRecord | null> {
  return prisma.maintenanceEvent.findFirst({ where: { id, buildingId }, include: eventInclude });
}

export async function maintenanceSeriesFacts(buildingId: string, eventId: string) {
  const [seriesCases, eventFiles, occurrenceFiles] = await Promise.all([
    prisma.case.count({ where: { buildingId, maintenanceEventId: eventId } }),
    prisma.maintenanceFile.count({ where: { eventId, event: { buildingId } } }),
    prisma.maintenanceOccurrence.count({
      where: { eventId, event: { buildingId }, fileStoredName: { not: null } },
    }),
  ]);
  return { seriesCases, fileCount: eventFiles + occurrenceFiles };
}

export async function overdueVisitsForBuilding(buildingId: string, now = new Date()) {
  const today = sydneyToday(now);
  const events = await prisma.maintenanceEvent.findMany({
    where: { buildingId },
    select: {
      id: true,
      subject: true,
      startDate: true,
      endDate: true,
      frequency: true,
      intervalMonths: true,
      occurrences: { select: { occursOn: true, state: true } },
    },
  });
  return overdueMaintenance(
    events.flatMap((event) => {
      const schedule = scheduleOf(event);
      if (!schedule) return [];
      return [{ id: event.id, subject: event.subject, schedule, records: event.occurrences.map(stored) }];
    }),
    today,
  );
}

export type CalendarMaintenance = { eventId: string; subject: string; iso: string; status: VisitStatus };
export type CalendarCase = { number: number; subject: string; iso: string };
export type CalendarWorkOrder = { number: string; subject: string; iso: string; time: string; caseNumber: number };

export async function loadCalendar(buildingId: string, fromIso: string, toIso: string) {
  const from = parseDateOnly(fromIso);
  const to = parseDateOnly(toIso);
  if (!from || !to) return { maintenance: [], cases: [], workOrders: [] };

  const [events, cases, workOrders] = await Promise.all([
    prisma.maintenanceEvent.findMany({
      where: { buildingId },
      select: {
        id: true,
        subject: true,
        startDate: true,
        endDate: true,
        frequency: true,
        intervalMonths: true,
        occurrences: { select: { occursOn: true, state: true } },
      },
    }),
    prisma.case.findMany({
      where: { buildingId, dueDate: { gte: from, lte: to } },
      select: { number: true, subject: true, dueDate: true },
      orderBy: { number: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        attendingAt: { gte: sydneyDayStart(shiftIso(fromIso, -1)) ?? from, lt: sydneyDayStart(shiftIso(toIso, 2)) ?? to },
        case: { buildingId },
      },
      select: { suffix: true, subject: true, attendingAt: true, case: { select: { number: true } } },
    }),
  ]);

  const today = sydneyToday();
  const maintenance: CalendarMaintenance[] = [];
  for (const event of events) {
    const schedule = scheduleOf(event);
    if (!schedule) continue;
    const states = new Map(event.occurrences.map((record) => [formatIsoDate(record.occursOn), stored(record).state]));
    for (const date of occurrencesBetween(schedule, from, to)) {
      const iso = formatIsoDate(date);
      const status = shownVisitStatus(date, states.get(iso) ?? null, today);
      if (!status) continue;
      maintenance.push({
        eventId: event.id,
        subject: event.subject,
        iso,
        status,
      });
    }
  }

  const workOrderItems: CalendarWorkOrder[] = [];
  for (const order of workOrders) {
    if (!order.attendingAt) continue;
    const iso = sydneyIso(order.attendingAt);
    if (iso < fromIso || iso > toIso) continue;
    workOrderItems.push({
      number: workOrderNumber(order.case.number, order.suffix),
      subject: order.subject,
      iso,
      time: sydneyTime(order.attendingAt),
      caseNumber: order.case.number,
    });
  }

  return {
    maintenance,
    cases: cases.map((item) => ({ number: item.number, subject: item.subject, iso: formatIsoDate(item.dueDate) })),
    workOrders: workOrderItems,
  };
}

export type OccurrencePanel = {
  eventId: string;
  occurrenceId: string | null;
  subject: string;
  iso: string;
  dateLabel: string;
  status: VisitStatus;
  note: string | null;
  fileName: string | null;
  actedBy: string | null;
  caseNumber: number | null;
  recurring: boolean;
  visitCases: number;
  seriesCases: number;
  fileCount: number;
};

export async function loadOccurrencePanel(
  buildingId: string,
  eventId: string,
  iso: string,
): Promise<OccurrencePanel | null> {
  const occursOn = parseDateOnly(iso);
  if (!occursOn) return null;
  const event = await prisma.maintenanceEvent.findFirst({
    where: { id: eventId, buildingId },
    include: {
      occurrences: { where: { occursOn }, include: { actedBy: { select: { name: true } } } },
    },
  });
  const schedule = event ? scheduleOf(event) : null;
  if (!event || !schedule || !isOccurrenceDate(schedule, occursOn)) return null;
  const record = event.occurrences[0] ?? null;
  if (record && stored(record).state === "removed") return null;
  const [linked, visitCases, seriesCases, eventFiles, occurrenceFiles] = await Promise.all([
    prisma.case.findFirst({
      where: { buildingId, maintenanceEventId: event.id, occurrenceOn: occursOn },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    prisma.case.count({ where: { buildingId, maintenanceEventId: event.id, occurrenceOn: occursOn } }),
    prisma.case.count({ where: { buildingId, maintenanceEventId: event.id } }),
    prisma.maintenanceFile.count({ where: { eventId: event.id } }),
    prisma.maintenanceOccurrence.count({ where: { eventId: event.id, fileStoredName: { not: null } } }),
  ]);
  return {
    eventId: event.id,
    occurrenceId: record?.id ?? null,
    subject: event.subject,
    iso,
    dateLabel: formatCalendarDate(occursOn),
    status: visitStatus(occursOn, record ? stored(record).state : null, sydneyToday()),
    note: record?.note ?? null,
    fileName: record?.fileName ?? null,
    actedBy: record?.actedBy.name ?? null,
    caseNumber: linked?.number ?? null,
    recurring: event.frequency !== "one_off",
    visitCases,
    seriesCases,
    fileCount: eventFiles + occurrenceFiles,
  };
}

export async function maintenanceCaseSource(
  buildingId: string,
  eventId: string,
  iso: string,
): Promise<{ eventId: string; occursOn: string; draft: CaseDraft } | null> {
  const occursOn = parseDateOnly(iso);
  if (!occursOn) return null;
  const event = await getMaintenance(buildingId, eventId);
  const schedule = event ? scheduleOf(event) : null;
  if (!event || !schedule || !isOccurrenceDate(schedule, occursOn)) return null;
  const repair = await prisma.caseType.findFirst({
    where: { name: "Repair & maintenance" },
    select: { id: true },
  });
  const fallback = repair ?? (await prisma.caseType.findFirst({ orderBy: { name: "asc" }, select: { id: true } }));
  if (!fallback) return null;
  return {
    eventId: event.id,
    occursOn: iso,
    draft: caseDraftFromOccurrence(
      {
        subject: event.subject,
        description: event.description,
        notes: event.notes,
        area: event.area,
        assetIds: event.assets.map((link) => link.assetId),
        apartmentId: event.apartmentId,
        companyIds: event.companies.map((link) => link.companyId),
        contactIds: event.contacts.map((link) => link.contactId),
      },
      iso,
      fallback.id,
    ),
  };
}

export async function maintenanceLinkFromForm(buildingId: string, formData: FormData) {
  const eventId = String(formData.get("maintenanceEventId") ?? "").trim();
  const occursOn = parseDateOnly(String(formData.get("occurrenceOn") ?? ""));
  if (!eventId || !occursOn) return null;
  const event = await prisma.maintenanceEvent.findFirst({
    where: { id: eventId, buildingId },
    select: { id: true, startDate: true, endDate: true, frequency: true, intervalMonths: true },
  });
  const schedule = event ? scheduleOf(event) : null;
  if (!event || !schedule || !isOccurrenceDate(schedule, occursOn)) return null;
  return { eventId: event.id, occursOn };
}

export function visibleRange(view: "month" | "week" | "agenda", anchorIso: string): { from: string; to: string } {
  const days = view === "week" ? weekCells(anchorIso) : monthDates(anchorIso);
  return { from: days[0], to: days[days.length - 1] };
}

export function calendarKinds(value: string | undefined): CalendarKind[] {
  if (!value) return ["maintenance", "case", "work_order"];
  const kinds = value.split(",").filter((kind): kind is CalendarKind => kind === "maintenance" || kind === "case" || kind === "work_order");
  return kinds.length > 0 ? kinds : ["maintenance", "case", "work_order"];
}

function toRow(event: MaintenanceRecord, today: Date, months: string[]): MaintenanceRow {
  const schedule = scheduleOf(event);
  const records = event.occurrences.map(stored);
  const upcoming = schedule ? occurrencesBetween(schedule, startOfMonth(today), addMonthsDate(today, 12)) : [];
  const removed = new Set(records.filter((record) => record.state === "removed").map((record) => formatIsoDate(record.occursOn)));
  return {
    id: event.id,
    subject: event.subject,
    startDate: event.startDate,
    endDate: event.endDate,
    frequency: event.frequency,
    intervalMonths: event.intervalMonths,
    companyNames: event.companies.map((link) => link.company.name).sort((a, b) => a.localeCompare(b, "en")),
    assetNames: event.assets.map((link) => link.asset.name).sort((a, b) => a.localeCompare(b, "en")),
    documentCount: event.files.length,
    remindContractor: event.remindContractor,
    nextDue: schedule ? nextDueDate(schedule, records, today) : null,
    upcomingDates: upcoming
      .map((date) => formatIsoDate(date))
      .filter((iso) => months.includes(iso.slice(0, 7)) && !removed.has(iso)),
    tab: schedule ? maintenanceTab(schedule, records, today) : "active",
  };
}

function compareRows(a: MaintenanceRow, b: MaintenanceRow, tab: MaintenanceTab): number {
  if (tab === "completed") {
    return (b.endDate?.getTime() ?? b.startDate.getTime()) - (a.endDate?.getTime() ?? a.startDate.getTime()) || a.subject.localeCompare(b.subject, "en");
  }
  const aDue = a.nextDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bDue = b.nextDue?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aDue - bDue || a.subject.localeCompare(b.subject, "en");
}

function stored(record: { occursOn: Date; state: string }): StoredOccurrence {
  return { occursOn: record.occursOn, state: asOccurrenceState(record.state) };
}

function timelineKeys(today: Date): string[] {
  return Array.from({ length: 12 }, (_, index) => formatIsoDate(addMonthsDate(startOfMonth(today), index)).slice(0, 7));
}

function startOfMonth(today: Date): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

function addMonthsDate(today: Date, months: number): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, today.getUTCDate()));
}

function shiftIso(iso: string, days: number): string {
  const date = parseDateOnly(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

function sydneyIso(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sydneyTime(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
