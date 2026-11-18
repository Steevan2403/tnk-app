import type { Metadata } from "next";
import { CalendarScreen, type CalendarDay, type CalendarDayItem } from "@/components/calendar-screen";
import { requireUser } from "@/lib/data";
import { formatIsoDate } from "@/lib/contractors";
import {
  CALENDAR_KINDS,
  CALENDAR_VIEWS,
  calendarTitle,
  isCalendarView,
  monthCells,
  shiftCalendar,
  sydneyToday,
  weekCells,
  type CalendarKind,
  type CalendarView,
} from "@/lib/maintenance";
import { calendarKinds, loadCalendar, loadOccurrencePanel, visibleRange } from "@/lib/maintenance-data";
import { canEditCases, canManageMaintenance } from "@/lib/roles";

export const metadata: Metadata = { title: "Calendar" };

const KIND_LABELS: Record<CalendarKind, string> = {
  maintenance: "Maintenance",
  case: "Cases",
  work_order: "Work orders",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = formatIsoDate(sydneyToday());
  const view: CalendarView = isCalendarView(first(params.view)) ? (first(params.view) as CalendarView) : "month";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(first(params.date)) ? first(params.date) : today;
  const kinds = calendarKinds(first(params.kinds) || undefined);
  const canManage = canManageMaintenance(user.role);
  const canCase = canEditCases(user.role);

  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Calendar</h1>
        <p className="mt-4 text-muted">Select a building to see its calendar.</p>
      </section>
    );
  }

  const range = visibleRange(view, anchor);
  const loaded = await loadCalendar(user.selectedBuildingId, range.from, range.to);
  const cells = view === "week" ? weekCells(anchor).map((iso) => ({ iso, inMonth: true })) : view === "agenda" ? monthCells(anchor).filter((cell) => cell.inMonth) : monthCells(anchor);
  const days: CalendarDay[] = cells.map((cell) => ({
    iso: cell.iso,
    inMonth: cell.inMonth,
    items: itemsFor(cell.iso, loaded, kinds, view, anchor, kinds.join(",")),
    maintenanceHref: `/maintenance/new?date=${cell.iso}`,
    caseHref: `/cases/new?date=${cell.iso}`,
  }));
  const eventId = first(params.event);
  const on = first(params.on);
  const panel = eventId && on ? await loadOccurrencePanel(user.selectedBuildingId, eventId, on) : null;
  const query = { view, date: anchor, kinds: kinds.join(",") };

  return (
    <section>
      <CalendarScreen
        view={view}
        title={calendarTitle(view, anchor)}
        todayIso={today}
        days={canCase ? days : days.map((day) => ({ ...day, caseHref: "/cases" }))}
        prevHref={href({ ...query, date: shiftCalendar(view, anchor, -1), event: "", on: "" })}
        nextHref={href({ ...query, date: shiftCalendar(view, anchor, 1), event: "", on: "" })}
        todayHref={href({ ...query, date: today, event: "", on: "" })}
        viewLinks={CALENDAR_VIEWS.map((item) => ({
          href: href({ ...query, view: item, event: eventId, on }),
          label: item === "month" ? "Month" : item === "week" ? "Week" : "Agenda",
          current: view === item,
        }))}
        kindLinks={CALENDAR_KINDS.map((kind) => {
          const next = kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind];
          return {
            href: href({ ...query, kinds: next.join(","), event: eventId, on }),
            label: KIND_LABELS[kind],
            current: kinds.includes(kind),
          };
        })}
        canManage={canManage}
        panel={panel}
        returnTo={href({ ...query, event: eventId, on })}
        today={today}
      />
    </section>
  );
}

function itemsFor(
  iso: string,
  loaded: Awaited<ReturnType<typeof loadCalendar>>,
  kinds: CalendarKind[],
  view: CalendarView,
  anchor: string,
  kindParam: string,
): CalendarDayItem[] {
  const items: CalendarDayItem[] = [];
  if (kinds.includes("maintenance")) {
    for (const item of loaded.maintenance) {
      if (item.iso !== iso) continue;
      items.push({
        key: `m-${item.eventId}-${iso}`,
        title: item.subject,
        href: href({ view, date: anchor, kinds: kindParam, event: item.eventId, on: iso }),
        tone: item.status,
      });
    }
  }
  if (kinds.includes("case")) {
    for (const item of loaded.cases) {
      if (item.iso !== iso) continue;
      items.push({
        key: `c-${item.number}`,
        title: item.subject,
        href: `/cases/${item.number}`,
        tone: "case",
      });
    }
  }
  if (kinds.includes("work_order")) {
    for (const item of loaded.workOrders) {
      if (item.iso !== iso) continue;
      items.push({
        key: `w-${item.number}`,
        title: item.number,
        href: `/cases/${item.caseNumber}`,
        tone: "work_order",
        meta: item.time,
      });
    }
  }
  return items;
}

function href(input: { view: CalendarView; date: string; kinds: string; event: string; on: string }): string {
  const search = new URLSearchParams();
  if (input.view !== "month") search.set("view", input.view);
  if (input.date) search.set("date", input.date);
  if (input.kinds && input.kinds !== "maintenance,case,work_order") search.set("kinds", input.kinds);
  if (input.event && input.on) {
    search.set("event", input.event);
    search.set("on", input.on);
  }
  const query = search.toString();
  return query ? `/calendar?${query}` : "/calendar";
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
