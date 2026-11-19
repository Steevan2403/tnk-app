import Link from "next/link";
import { completeOccurrence, deleteMaintenanceEvent, skipOccurrence } from "@/app/actions/maintenance";
import { deleteConfirmButtonClass, DeleteConfirm } from "@/components/delete-confirm";
import { FileField, TextArea, TextField } from "@/components/field";
import { maintenanceDeletePrompt } from "@/lib/maintenance";
import { formatCalendarDate } from "@/lib/cases";
import { formatVisitStatus, type VisitStatus } from "@/lib/maintenance";
import type { OccurrencePanel } from "@/lib/maintenance-data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TONE: Record<string, string> = {
  upcoming: "bg-brand-blue/10 text-brand-navy",
  overdue: "bg-red-50 text-danger",
  completed: "bg-brand-green/15 text-brand-navy",
  skipped: "bg-page text-muted",
  case: "bg-brand-navy/10 text-brand-navy",
  work_order: "border border-line bg-page text-ink",
};

export type CalendarDayItem = {
  key: string;
  title: string;
  href: string;
  tone: string;
  meta?: string;
};

export type CalendarDay = {
  iso: string;
  inMonth: boolean;
  items: CalendarDayItem[];
  maintenanceHref: string;
  caseHref: string;
};

export function CalendarScreen({
  view,
  title,
  todayIso,
  days,
  prevHref,
  nextHref,
  todayHref,
  viewLinks,
  kindLinks,
  canManage,
  panel,
  returnTo,
  today,
}: {
  view: "month" | "week" | "agenda";
  title: string;
  todayIso: string;
  days: CalendarDay[];
  prevHref: string;
  nextHref: string;
  todayHref: string;
  viewLinks: { href: string; label: string; current: boolean }[];
  kindLinks: { href: string; label: string; current: boolean }[];
  canManage: boolean;
  panel: OccurrencePanel | null;
  returnTo: string;
  today: string;
}) {
  return (
    <div className={panel ? "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6" : undefined}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl">Calendar</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={todayHref} className="rounded-lg border border-line bg-card px-3 py-2 font-medium shadow-sm hover:border-brand-blue">
              Today
            </Link>
            <Link href={prevHref} className="rounded-lg border border-line bg-card px-3 py-2 font-medium shadow-sm hover:border-brand-blue">
              Previous
            </Link>
            <Link href={nextHref} className="rounded-lg border border-line bg-card px-3 py-2 font-medium shadow-sm hover:border-brand-blue">
              Next
            </Link>
          </div>
        </div>
        <p className="mt-4 text-lg font-semibold tracking-tight text-brand-navy">{title}</p>
        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-line">
          {viewLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.current ? "page" : undefined}
              className={`rounded-md px-3 py-1 text-sm font-medium ${link.current ? "bg-brand-navy text-white" : "text-ink hover:text-brand-blue"}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Show">
          {kindLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.current ? "true" : undefined}
              className={`rounded-full px-3 py-1 text-sm ${link.current ? "bg-brand-blue text-white" : "bg-card text-muted ring-1 ring-line"}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          <li className="rounded-full bg-brand-blue/10 px-2.5 py-1 font-medium text-brand-navy">Upcoming</li>
          <li className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-danger">Overdue</li>
          <li className="rounded-full bg-[#d1fae5] px-2.5 py-1 font-medium text-[#065f46]">Completed</li>
          <li className="rounded-full bg-brand-navy/10 px-2.5 py-1 font-medium text-brand-navy">Case</li>
          <li className="rounded-full border border-line bg-card px-2.5 py-1 font-medium">Work order</li>
        </ul>

        {view === "month" ? (
          <MonthView days={days} todayIso={todayIso} canManage={canManage} />
        ) : view === "agenda" ? (
          <Agenda days={days} todayIso={todayIso} canManage={canManage} />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-card">
            <table className="calendar-grid w-full min-w-[64rem] border-collapse text-sm">
              <thead>
                <tr>
                  {WEEKDAYS.map((day) => (
                    <th key={day} scope="col" className="border border-line bg-[#f6f7fb] px-2 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsOf(days, 7).map((row) => (
                  <tr key={row[0].iso}>
                    {row.map((day) => (
                      <td
                        key={day.iso}
                        className={`h-48 border border-line align-top p-2 ${day.iso === todayIso ? "bg-brand-blue/5" : "bg-card"} ${
                          day.inMonth ? "" : "text-muted"
                        }`}
                      >
                        <DayBody day={day} canManage={canManage} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {panel ? <OccurrenceAside panel={panel} returnTo={returnTo} today={today} canManage={canManage} /> : null}
    </div>
  );
}

function MonthView({ days, todayIso, canManage }: { days: CalendarDay[]; todayIso: string; canManage: boolean }) {
  return (
    <>
      <div className="sm:hidden">
        <Agenda days={days.filter((day) => day.inMonth)} todayIso={todayIso} canManage={canManage} showWeekday />
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-card sm:block">
        <div role="grid" aria-label="Month" className="calendar-grid grid w-full gap-px bg-line text-sm">
          <div role="row" className="grid gap-px" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {WEEKDAYS.map((day) => (
              <div key={day} role="columnheader" className="truncate bg-[#f6f7fb] px-2 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                {day}
              </div>
            ))}
          </div>
          {rowsOf(days, 7).map((week) => (
            <div key={week[0].iso} role="row" className="grid gap-px" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              {week.map((day) => (
                <div
                  key={day.iso}
                  role="gridcell"
                  className={`min-h-32 min-w-0 p-2 ${day.iso === todayIso ? "bg-brand-blue/5" : "bg-card"} ${day.inMonth ? "" : "text-muted"}`}
                >
                  <DayBody day={day} canManage={canManage} truncate />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Agenda({
  days,
  todayIso,
  canManage,
  showWeekday = false,
}: {
  days: CalendarDay[];
  todayIso: string;
  canManage: boolean;
  showWeekday?: boolean;
}) {
  const filled = days.filter((day) => day.items.length > 0);
  if (filled.length === 0) return <p className="mt-6 text-muted">Nothing scheduled in this month.</p>;
  return (
    <div className="mt-4 space-y-4">
      {filled.map((day) => (
        <section key={day.iso} className={`rounded-xl border border-line bg-card p-4 ${day.iso === todayIso ? "ring-2 ring-brand-blue" : ""}`}>
          <h2 className="text-lg font-medium">{dayHeading(day.iso, showWeekday)}</h2>
          <DayItems day={day} />
          <NewMenu day={day} canManage={canManage} />
        </section>
      ))}
    </div>
  );
}

function dayHeading(iso: string, showWeekday: boolean): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const label = formatCalendarDate(date);
  if (!showWeekday) return label;
  const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "long", timeZone: "UTC" }).format(date);
  return `${weekday}, ${label}`;
}

function DayBody({ day, canManage, truncate = false }: { day: CalendarDay; canManage: boolean; truncate?: boolean }) {
  return (
    <>
      <time dateTime={day.iso} className="text-xs font-medium">
        {Number(day.iso.slice(8))}
      </time>
      <DayItems day={day} truncate={truncate} />
      <NewMenu day={day} canManage={canManage} />
    </>
  );
}

function DayItems({ day, truncate = false }: { day: CalendarDay; truncate?: boolean }) {
  if (day.items.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1">
      {day.items.map((item) => (
        <li key={item.key} className={truncate ? "min-w-0" : undefined}>
          <Link
            href={item.href}
            title={item.title}
            className={`block rounded px-1.5 py-1 text-xs leading-snug ${truncate ? "truncate" : "break-words"} ${TONE[item.tone] ?? TONE.upcoming}`}
          >
            {item.meta ? <span className="mr-1">{item.meta}</span> : null}
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewMenu({ day, canManage }: { day: CalendarDay; canManage: boolean }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-brand-blue">New</summary>
      <div className="mt-1 flex flex-col gap-1 text-xs">
        {canManage ? (
          <Link href={day.maintenanceHref} className="text-brand-blue hover:underline">
            Maintenance
          </Link>
        ) : null}
        <Link href={day.caseHref} className="text-brand-blue hover:underline">
          Case
        </Link>
      </div>
    </details>
  );
}

function OccurrenceAside({
  panel,
  returnTo,
  today,
  canManage,
}: {
  panel: OccurrencePanel;
  returnTo: string;
  today: string;
  canManage: boolean;
}) {
  const open = panel.status === "upcoming" || panel.status === "overdue";
  const prompt = maintenanceDeletePrompt({
    subject: panel.subject,
    dateLabel: panel.dateLabel,
    recurring: panel.recurring,
    visitCases: panel.visitCases,
    seriesCases: panel.seriesCases,
    fileCount: panel.fileCount,
  });
  return (
    <aside aria-label="Occurrence" className="mt-6 rounded-xl border border-line bg-card p-4 lg:mt-0">
      <h2 className="text-lg font-medium text-brand-navy">{panel.subject}</h2>
      <p className="mt-2 text-sm">
        <time dateTime={panel.iso}>{formatCalendarDate(new Date(`${panel.iso}T00:00:00.000Z`))}</time>
        {" · "}
        {formatVisitStatus(panel.status as VisitStatus)}
      </p>
      {panel.actedBy ? <p className="mt-2 text-sm text-muted">Recorded by {panel.actedBy}</p> : null}
      {panel.note ? <p className="mt-2 whitespace-pre-wrap text-sm">{panel.note}</p> : null}
      {panel.fileName && panel.occurrenceId ? (
        <p className="mt-2 text-sm">
          <a href={`/api/maintenance-occurrences/${panel.occurrenceId}/file`} className="text-brand-blue hover:underline">
            {panel.fileName}
          </a>
        </p>
      ) : null}
      {panel.caseNumber ? (
        <p className="mt-4 text-sm">
          <Link href={`/cases/${panel.caseNumber}`} className="text-brand-blue hover:underline">
            Case #{panel.caseNumber}
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-sm">
          <Link href={`/cases/new?event=${panel.eventId}&on=${panel.iso}`} className="text-brand-blue hover:underline">
            Create case
          </Link>
        </p>
      )}
      {open ? (
        <div className="mt-4 space-y-6">
          <form action={completeOccurrence} className="space-y-3">
            <input type="hidden" name="eventId" value={panel.eventId} />
            <input type="hidden" name="occursOn" value={panel.iso} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <TextField label="Completed on" name="completedOn" type="date" defaultValue={today} required />
            <TextArea label="Note" name="note" rows={3} placeholder="Optional" />
            <FileField label="File" name="file" />
            <button type="submit" className="rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue">
              Mark complete
            </button>
          </form>
          <form action={skipOccurrence} className="space-y-3">
            <input type="hidden" name="eventId" value={panel.eventId} />
            <input type="hidden" name="occursOn" value={panel.iso} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <TextArea label="Reason" name="reason" rows={2} required />
            <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-brand-blue">
              Skip
            </button>
          </form>
        </div>
      ) : null}
      {canManage ? (
        <div className="mt-4">
          <DeleteConfirm label="Delete" title={prompt.title} message={prompt.message}>
            {panel.recurring ? (
              <form action={deleteMaintenanceEvent}>
                <DeleteFields panel={panel} returnTo={returnTo} scope="occurrence" />
                <button type="submit" className={deleteConfirmButtonClass}>
                  Delete this visit
                </button>
              </form>
            ) : null}
            <form action={deleteMaintenanceEvent}>
              <DeleteFields panel={panel} returnTo={returnTo} scope="series" />
              <button type="submit" className={deleteConfirmButtonClass}>
                {panel.recurring ? "Delete whole series" : "Delete event"}
              </button>
            </form>
          </DeleteConfirm>
        </div>
      ) : null}
    </aside>
  );
}

function DeleteFields({ panel, returnTo, scope }: { panel: OccurrencePanel; returnTo: string; scope: "occurrence" | "series" }) {
  return (
    <>
      <input type="hidden" name="eventId" value={panel.eventId} />
      <input type="hidden" name="occursOn" value={panel.iso} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="scope" value={scope} />
    </>
  );
}

function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}
