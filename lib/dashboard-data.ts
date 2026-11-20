import { formatDateTime, formatIsoDate } from "./contractors";
import {
  actionCounts,
  casesByType,
  chartPeriodStart,
  failedItemSinceIso,
  groupActivityByDay,
  isOpenCase,
  latestActivity,
  sydneyMonthBounds,
  upcomingRange,
  type ActivityEntry,
  type ChartPeriod,
} from "./dashboard";
import { prisma } from "./db";
import { calendarTitle, monthCells, sydneyToday } from "./maintenance";
import { loadCalendar, overdueVisitsForBuilding, visibleRange } from "./maintenance-data";
import { periodLabel, reportFormatLabel } from "./reports";
import { siteVisitActivity } from "./check-in";
import { sentRange, workOrderNumber } from "./work-orders";

export async function loadDashboard(
  buildingId: string,
  input: { months: ChartPeriod; noteQuery: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const todayIso = formatIsoDate(sydneyToday(now));
  const periodStart = chartPeriodStart(input.months, now);
  const periodStartIso = formatIsoDate(periodStart);
  const month = visibleRange("month", todayIso);
  const upcoming = upcomingRange(now);
  const calendarTo = upcoming.to > month.to ? upcoming.to : month.to;
  const monthBounds = sydneyMonthBounds(now);
  const sent = sentRange(monthBounds.from, monthBounds.to);
  const failedSince = failedItemSinceIso(now);

  const [
    cases,
    visits,
    assets,
    companies,
    failedRows,
    residentCount,
    apartmentCount,
    workOrderCount,
    latestOrders,
    calendar,
    notes,
    numbers,
    caseActivity,
    siteVisits,
    occurrences,
    runs,
    reports,
    buildingActivity,
  ] = await Promise.all([
    prisma.case.findMany({
      where: { buildingId },
      select: {
        startDate: true,
        dueDate: true,
        status: true,
        typeId: true,
        type: { select: { name: true } },
      },
    }),
    overdueVisitsForBuilding(buildingId, now),
    prisma.asset.findMany({
      where: { buildingId },
      select: { warranties: { select: { expiresOn: true } } },
    }),
    prisma.contractorCompany.findMany({
      select: { status: true, insurances: { select: { expiresOn: true } } },
    }),
    prisma.inspectionRunItem.findMany({
      where: { result: "fail", area: { run: { buildingId, status: "completed" } } },
      select: {
        result: true,
        linkedCase: { select: { id: true } },
        area: { select: { run: { select: { completedAt: true } } } },
      },
    }),
    prisma.resident.count({ where: { apartment: { buildingId } } }),
    prisma.apartment.count({ where: { buildingId } }),
    prisma.workOrder.count({
      where: {
        case: { buildingId },
        ...(sent.from && sent.to ? { sentAt: { gte: sent.from, lt: sent.to } } : {}),
      },
    }),
    prisma.workOrder.findMany({
      where: { case: { buildingId } },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        suffix: true,
        companyName: true,
        status: true,
        sentAt: true,
        case: { select: { number: true } },
      },
    }),
    loadCalendar(buildingId, month.from, calendarTo),
    prisma.buildingNote.findMany({
      where: {
        buildingId,
        ...(input.noteQuery
          ? {
              OR: [{ title: { contains: input.noteQuery } }, { body: { contains: input.noteQuery } }],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.usefulNumber.findMany({
      where: { buildingId },
      orderBy: [{ label: "asc" }, { id: "asc" }],
    }),
    prisma.caseActivity.findMany({
      where: { case: { buildingId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        summary: true,
        createdAt: true,
        actor: { select: { name: true } },
        case: { select: { number: true } },
      },
    }),
    prisma.workOrderVisit.findMany({
      where: { workOrder: { case: { buildingId } } },
      orderBy: [{ checkedInAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        contractorName: true,
        checkedInAt: true,
        checkedOutAt: true,
        workOrder: { select: { id: true, suffix: true, case: { select: { number: true } } } },
      },
    }),
    prisma.maintenanceOccurrence.findMany({
      where: { event: { buildingId }, state: { not: "removed" } },
      orderBy: [{ actedAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        occursOn: true,
        state: true,
        actedAt: true,
        actedBy: { select: { name: true } },
        event: { select: { id: true, subject: true } },
      },
    }),
    prisma.inspectionRun.findMany({
      where: { buildingId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        name: true,
        createdAt: true,
        completedAt: true,
        status: true,
        inspector: { select: { name: true } },
      },
    }),
    prisma.generatedReport.findMany({
      where: { buildingId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, periodFrom: true, periodTo: true, format: true, createdAt: true },
    }),
    prisma.buildingActivity.findMany({
      where: { buildingId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        summary: true,
        href: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  const counts = actionCounts({
    cases,
    overdueVisits: visits,
    assets,
    companies,
    failedItems: failedRows.map((item) => ({
      result: item.result,
      caseId: item.linkedCase?.id ?? null,
      completedAt: item.area.run.completedAt,
    })),
    today: now,
  });

  const slices = casesByType(
    cases.map((item) => ({ startDate: item.startDate, typeId: item.typeId, typeName: item.type.name })),
    input.months,
    now,
  ).map((slice) => ({
    ...slice,
    href: `/cases?type=${slice.typeId}&from=${periodStartIso}&to=${todayIso}`,
  }));

  const marked = new Set<string>();
  for (const item of calendar.maintenance) marked.add(item.iso);
  for (const item of calendar.cases) marked.add(item.iso);
  for (const item of calendar.workOrders) marked.add(item.iso);

  const activity: ActivityEntry[] = [
    ...caseActivity.map((item) => ({
      id: `case-${item.id}`,
      at: item.createdAt,
      userName: item.actor.name,
      action: item.summary,
      href: `/cases/${item.case.number}`,
    })),
    ...siteVisitActivity(
      siteVisits.map((visit) => ({
        id: visit.workOrder.id,
        suffix: visit.workOrder.suffix,
        caseNumber: visit.workOrder.case.number,
        visits: [visit],
      })),
    ).map((item) => ({
      id: `site-${item.id}`,
      at: item.at,
      userName: item.actorName,
      action: item.summary,
      href: item.href,
    })),
    ...occurrences.map((item) => ({
      id: `visit-${item.id}`,
      at: item.actedAt,
      userName: item.actedBy.name,
      action: item.state === "skipped" ? `Skipped ${item.event.subject}.` : `Completed ${item.event.subject}.`,
      href: `/calendar?date=${formatIsoDate(item.occursOn)}&event=${item.event.id}&on=${formatIsoDate(item.occursOn)}`,
    })),
    ...buildingActivity.map((item) => ({
      id: `building-${item.id}`,
      at: item.createdAt,
      userName: item.actor.name,
      action: item.summary,
      href: item.href,
    })),
    ...runs.flatMap((run) => {
      const href = `/building/inspections/runs/${run.id}`;
      const started: ActivityEntry = {
        id: `run-start-${run.id}`,
        at: run.createdAt,
        userName: run.inspector.name,
        action: `Started ${run.name}.`,
        href,
      };
      if (!run.completedAt || run.status !== "completed") return [started];
      return [
        started,
        {
          id: `run-done-${run.id}`,
          at: run.completedAt,
          userName: run.inspector.name,
          action: `Completed ${run.name}.`,
          href,
        },
      ];
    }),
  ];

  const upcomingVisits = calendar.maintenance
    .filter((item) => item.iso >= upcoming.from && item.iso <= upcoming.to && item.status === "upcoming")
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.subject.localeCompare(b.subject, "en"))
    .map((item) => ({
      id: `${item.eventId}-${item.iso}`,
      subject: item.subject,
      iso: item.iso,
      href: `/calendar?date=${item.iso}&event=${item.eventId}&on=${item.iso}`,
    }));

  return {
    months: input.months,
    noteQuery: input.noteQuery,
    todayIso,
    monthTitle: calendarTitle("month", todayIso),
    periodStartIso,
    counts,
    links: {
      overdueCases: "/cases?overdue=1",
      overdueMaintenance: "/maintenance?tab=overdue",
      expiredWarranties: "/building/assets?warranty=expired",
      expiredInsurance: "/contractors?tab=expired",
      failedInspections: `/building/inspections?tab=completed&openFails=1&from=${failedSince}`,
    },
    calendar: {
      cells: monthCells(todayIso),
      marked,
      href: `/calendar?date=${todayIso}`,
    },
    slices,
    summary: {
      residents: { count: residentCount, href: "/residents", label: "Residents" },
      apartments: { count: apartmentCount, href: "/residents?tab=apartments", label: "Apartments" },
      assets: { count: assets.length, href: "/building/assets", label: "Assets" },
      contractors: {
        count: companies.filter((company) => company.status === "approved").length,
        href: "/contractors?tab=companies",
        label: "Contractors",
      },
      openCases: { count: cases.filter((item) => isOpenCase(item.status)).length, href: "/cases", label: "Open cases" },
      workOrders: {
        count: workOrderCount,
        href: `/work-orders?from=${monthBounds.from}&to=${monthBounds.to}`,
        label: "Work orders this month",
      },
    },
    workOrders: latestOrders.map((order) => ({
      id: order.id,
      number: workOrderNumber(order.case.number, order.suffix),
      companyName: order.companyName,
      status: order.status,
      sentAt: order.sentAt,
      href: `/cases/${order.case.number}`,
    })),
    upcomingVisits,
    notes,
    numbers,
    activity: groupActivityByDay(latestActivity(activity)),
    reports: reports.map((report) => ({
      id: report.id,
      periodLabel: periodLabel(report.periodFrom, report.periodTo),
      createdLabel: formatDateTime(report.createdAt),
      formatLabel: reportFormatLabel(report.format),
      href: `/api/reports/${report.id}/file`,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
