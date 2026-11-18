import Link from "next/link";
import { completeOccurrence, skipOccurrence } from "@/app/actions/maintenance";
import { FileField, TextArea, TextField } from "@/components/field";
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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl">Calendar</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={todayHref} className="rounded-md border border-line bg-card px-3 py-2 hover:border-brand-blue">
              Today
            </Link>
            <Link href={prevHref} className="rounded-md border border-line bg-card px-3 py-2 hover:border-brand-blue">
              Previous
            </Link>
            <Link href={nextHref} className="rounded-md border border-line bg-card px-3 py-2 hover:border-brand-blue">
              Next
            </Link>
          </div>
        </div>
        <p className="mt-4 text-lg font-medium text-brand-navy">{title}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {viewLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.current ? "page" : undefined}
              className={`rounded-md px-3 py-1 text-sm ${link.current ? "bg-brand-navy text-white" : "bg-card text-ink ring-1 ring-line"}`}
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
              aria-pressed={link.current}
              className={`rounded-full px-3 py-1 text-sm ${link.current ? "bg-brand-blue text-white" : "bg-card text-muted ring-1 ring-line"}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          <li className="rounded bg-brand-blue/10 px-2 py-1 text-brand-navy">Upcoming</li>
          <li className="rounded bg-red-50 px-2 py-1 text-danger">Overdue</li>
          <li className="rounded bg-brand-green/15 px-2 py-1 text-brand-navy">Completed</li>
          <li className="rounded bg-brand-navy/10 px-2 py-1 text-brand-navy">Case</li>
          <li className="rounded border border-line bg-page px-2 py-1">Work order</li>
        </ul>

        {view === "agenda" ? (
          <Agenda days={days} todayIso={todayIso} canManage={canManage} />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className={`w-full min-w-[46rem] border-collapse text-sm ${view === "week" ? "min-w-[64rem]" : ""}`}>
              <thead>
                <tr>
                  {WEEKDAYS.map((day) => (
                    <th key={day} scope="col" className="border border-line bg-card px-2 py-2 text-left font-medium text-muted">
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
                        className={`border border-line align-top p-2 ${view === "week" ? "h-48" : "h-32"} ${
                          day.iso === todayIso ? "bg-brand-blue/5" : "bg-card"
                        } ${day.inMonth ? "" : "text-muted"}`}
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
      {panel ? <OccurrenceAside panel={panel} returnTo={returnTo} today={today} /> : null}
    </div>
  );
}

function Agenda({ days, todayIso, canManage }: { days: CalendarDay[]; todayIso: string; canManage: boolean }) {
  const filled = days.filter((day) => day.items.length > 0);
  if (filled.length === 0) return <p className="mt-6 text-muted">Nothing scheduled in this month.</p>;
  return (
    <div className="mt-4 space-y-4">
      {filled.map((day) => (
        <section key={day.iso} className={`rounded-xl border border-line bg-card p-4 ${day.iso === todayIso ? "ring-2 ring-brand-blue" : ""}`}>
          <h2 className="text-lg font-medium">{formatCalendarDate(new Date(`${day.iso}T00:00:00.000Z`))}</h2>
          <DayItems day={day} />
          <NewMenu day={day} canManage={canManage} />
        </section>
      ))}
    </div>
  );
}

function DayBody({ day, canManage }: { day: CalendarDay; canManage: boolean }) {
  return (
    <>
      <time dateTime={day.iso} className="text-xs font-medium">
        {Number(day.iso.slice(8))}
      </time>
      <DayItems day={day} />
      <NewMenu day={day} canManage={canManage} />
    </>
  );
}

function DayItems({ day }: { day: CalendarDay }) {
  if (day.items.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1">
      {day.items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className={`block rounded px-1.5 py-1 text-xs leading-snug ${TONE[item.tone] ?? TONE.upcoming}`}>
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

function OccurrenceAside({ panel, returnTo, today }: { panel: OccurrencePanel; returnTo: string; today: string }) {
  const open = panel.status === "upcoming" || panel.status === "overdue";
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
    </aside>
  );
}

function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}
