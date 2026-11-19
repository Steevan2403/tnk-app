import type { ReactNode } from "react";
import Link from "next/link";
import { deleteBuildingNote, deleteUsefulNumber } from "@/app/actions/dashboard";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BuildingNoteForm, UsefulNumberForm } from "@/components/dashboard-forms";
import { TextField } from "@/components/field";
import { formatCalendarDate } from "@/lib/contractors";
import {
  canAddBuildingNote,
  canDeleteBuildingNote,
  canEditBuildingNote,
  canManageUsefulNumbers,
  sydneyDayLabel,
  telHref,
  CHART_PERIODS,
} from "@/lib/dashboard";
import type { DashboardData } from "@/lib/dashboard-data";
import { EmptyState, StatusBadge } from "@/components/ui";
import { formatWorkOrderStatus } from "@/lib/work-orders";

const SLICE_COLOURS = ["#000080", "#0066cc", "#10b981", "#1f2937", "#4b5563", "#38bdf8", "#6ee7b7", "#c7d2fe"];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DashboardView({
  data,
  user,
  editNoteId,
  editNumberId,
}: {
  data: DashboardData;
  user: { id: string; role: string };
  editNoteId: string;
  editNumberId: string;
}) {
  const canNotes = canAddBuildingNote(user.role);
  const canNumbers = canManageUsefulNumbers(user.role);
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <ActionCard data={data} />
      <CalendarCard data={data} />
      <CasesCard data={data} />
      <SummaryCard data={data} />
      <WorkOrdersCard data={data} />
      <UpcomingCard data={data} />
      <NotesCard data={data} userId={user.id} role={user.role} canAdd={canNotes} editNoteId={editNoteId} className="md:col-span-2 xl:col-span-2" />
      <NumbersCard data={data} canManage={canNumbers} editNumberId={editNumberId} />
      <ActivityCard data={data} className="md:col-span-2 xl:col-span-2" />
      <ReportsCard data={data} />
    </div>
  );
}

function Card({
  title,
  id,
  className,
  children,
}: {
  title: string;
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`rounded-xl border border-line bg-card p-4 md:p-5 ${className ?? ""}`}>
      <h2 id={id} className="text-lg font-semibold tracking-tight text-brand-navy">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ActionCard({ data }: { data: DashboardData }) {
  const rows = [
    { label: "Overdue cases", count: data.counts.overdueCases, href: data.links.overdueCases, zero: "No overdue cases." },
    {
      label: "Overdue maintenance",
      count: data.counts.overdueMaintenance,
      href: data.links.overdueMaintenance,
      zero: "No overdue visits in the last 12 months.",
    },
    {
      label: "Expired warranties",
      count: data.counts.expiredWarranties,
      href: data.links.expiredWarranties,
      zero: "No expired warranties.",
    },
    {
      label: "Expired insurance",
      count: data.counts.expiredInsurance,
      href: data.links.expiredInsurance,
      zero: "No expired insurance.",
    },
    {
      label: "Failed inspection items",
      count: data.counts.failedInspections,
      href: data.links.failedInspections,
      zero: "No failed items without a case in the last 90 days.",
    },
  ];
  return (
    <Card title="Items needing action" id="dashboard-actions">
      <ul className="mt-3 divide-y divide-line">
        {rows.map((row) => (
          <li key={row.label} className="py-2">
            <Link href={row.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-page">
              <span>{row.label}</span>
              <span
                className={`inline-flex min-w-8 justify-center rounded-full px-2 py-0.5 text-sm font-semibold ${
                  row.count > 0 ? "bg-red-50 text-danger" : "bg-page text-muted"
                }`}
              >
                {row.count}
              </span>
            </Link>
            {row.count === 0 ? <p className="text-sm text-muted">{row.zero}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CalendarCard({ data }: { data: DashboardData }) {
  return (
    <Card title={data.monthTitle} id="dashboard-calendar">
      <div className="mt-3 grid grid-cols-7 text-center text-xs text-muted">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-sm">
        {data.calendar.cells.map((cell) => {
          const label = formatCalendarDate(new Date(`${cell.iso}T00:00:00.000Z`));
          const marked = data.calendar.marked.has(cell.iso);
          const today = cell.iso === data.todayIso;
          return (
            <Link
              key={cell.iso}
              href={`/calendar?date=${cell.iso}`}
              aria-label={marked ? `${label}, scheduled` : label}
              className={`flex h-9 flex-col items-center justify-center rounded-md ${
                today ? "bg-brand-navy text-white" : cell.inMonth ? "text-ink hover:bg-page" : "text-muted hover:bg-page"
              }`}
            >
              <span>{Number(cell.iso.slice(8))}</span>
              <span
                aria-hidden="true"
                className={`mt-0.5 size-2 rounded-full ${marked ? (today ? "bg-white" : "bg-brand-blue") : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
      <Link href={data.calendar.href} className="mt-3 inline-block text-sm text-brand-blue hover:underline">
        Open calendar
      </Link>
    </Card>
  );
}

function CasesCard({ data }: { data: DashboardData }) {
  const total = data.slices.reduce((sum, slice) => sum + slice.count, 0);
  return (
    <Card title="Cases by type" id="dashboard-cases">
      <nav aria-label="Case period" className="mt-3 flex flex-wrap gap-1 rounded-lg bg-page p-1">
        {CHART_PERIODS.map((months) => {
          const current = months === data.months;
          return (
            <Link
              key={months}
              href={dashboardHref({ months, note: data.noteQuery })}
              aria-current={current ? "page" : undefined}
              className={`rounded-md px-2.5 py-1 text-sm font-medium ${current ? "bg-brand-navy text-white" : "text-ink hover:text-brand-blue"}`}
            >
              {months === 1 ? "1 month" : `${months} months`}
            </Link>
          );
        })}
      </nav>
      {total === 0 ? (
        <p className="mt-4 text-muted">No cases started in this period.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Donut slices={data.slices} total={total} period={data.months} />
          <ul className="min-w-40 space-y-1 text-sm">
            {data.slices.map((slice, index) => (
              <li key={slice.typeId}>
                <Link href={slice.href} className="flex items-center gap-2 hover:underline">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: SLICE_COLOURS[index % SLICE_COLOURS.length] }}
                  />
                  <span>
                    {slice.typeName} {slice.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Donut({
  slices,
  total,
  period,
}: {
  slices: DashboardData["slices"];
  total: number;
  period: number;
}) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 2 : 0;
  const placed = slices.map((slice, index) => {
    const used = slices.slice(0, index).reduce((sum, item) => sum + item.count, 0);
    return {
      slice,
      index,
      length: Math.max(0, (slice.count / total) * circ - gap),
      offset: (used / total) * circ,
    };
  });
  return (
    <svg viewBox="0 0 120 120" className="h-40 w-40" role="group" aria-label={`Cases by type, ${total} in the last ${period === 1 ? "month" : `${period} months`}`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
      {placed.map(({ slice, index, length, offset }) => (
        <a key={slice.typeId} href={slice.href} aria-label={`${slice.typeName}, ${slice.count}`}>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={SLICE_COLOURS[index % SLICE_COLOURS.length]}
            strokeWidth="16"
            strokeDasharray={`${length} ${circ - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        </a>
      ))}
      <text x="60" y="64" textAnchor="middle" fill="#000080" fontSize="18">
        {total}
      </text>
    </svg>
  );
}

function SummaryCard({ data }: { data: DashboardData }) {
  const items = [
    data.summary.residents,
    data.summary.apartments,
    data.summary.assets,
    data.summary.contractors,
    data.summary.openCases,
    data.summary.workOrders,
  ];
  return (
    <Card title="Building summary" id="dashboard-summary">
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="block rounded-xl bg-page px-3 py-3 hover:ring-2 hover:ring-brand-blue/30">
              <span className="block text-2xl font-semibold tracking-tight text-brand-navy">{item.count}</span>
              <span className="text-sm text-muted">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WorkOrdersCard({ data }: { data: DashboardData }) {
  return (
    <Card title="Latest work orders" id="dashboard-work-orders">
      {data.workOrders.length === 0 ? (
        <EmptyState>No work orders yet.</EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {data.workOrders.map((order) => (
            <li key={order.id} className="py-2">
              <Link href={order.href} className="font-medium text-brand-blue hover:underline">
                {order.number}
              </Link>
              <p>{order.companyName}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
                <StatusBadge status={order.status} label={formatWorkOrderStatus(order.status)} />
                <span>{sydneyDayLabel(order.sentAt)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link href="/work-orders" className="mt-3 inline-block text-sm text-brand-blue hover:underline">
        All work orders
      </Link>
    </Card>
  );
}

function UpcomingCard({ data }: { data: DashboardData }) {
  return (
    <Card title="Upcoming maintenance" id="dashboard-upcoming">
      {data.upcomingVisits.length === 0 ? (
        <EmptyState>No visits in the next 7 days.</EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {data.upcomingVisits.map((visit) => (
            <li key={visit.id} className="py-2">
              <Link href={visit.href} className="font-medium text-brand-blue hover:underline">
                {visit.subject}
              </Link>
              <p className="text-muted">
                <time dateTime={visit.iso}>{formatCalendarDate(new Date(`${visit.iso}T00:00:00.000Z`))}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NotesCard({
  data,
  userId,
  role,
  canAdd,
  editNoteId,
  className,
}: {
  data: DashboardData;
  userId: string;
  role: string;
  canAdd: boolean;
  editNoteId: string;
  className?: string;
}) {
  return (
    <Card title="Notes" id="dashboard-notes" className={className}>
      <form method="get" action="/dashboard" className="mt-3 flex flex-wrap items-end gap-3">
        {data.months === 3 ? null : <input type="hidden" name="months" value={data.months} />}
        <div className="min-w-48 flex-1">
          <TextField label="Search notes" name="note" type="search" defaultValue={data.noteQuery} />
        </div>
        <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
          Search
        </button>
      </form>
      {data.noteQuery ? (
        <Link href={dashboardHref({ months: data.months, note: "" })} className="mt-2 inline-block text-sm text-brand-blue hover:underline">
          Clear search
        </Link>
      ) : null}
      {data.notes.length === 0 ? (
        <EmptyState>{data.noteQuery ? "No notes match." : "No notes yet."}</EmptyState>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {data.notes.map((note) => {
            const editing = editNoteId === note.id && canEditBuildingNote(role, note.authorId, userId);
            return (
              <li key={note.id} className="py-3">
                {note.title ? <p className="font-medium">{note.title}</p> : null}
                {editing ? (
                  <BuildingNoteForm note={{ id: note.id, title: note.title, body: note.body }} />
                ) : (
                  <p className="whitespace-pre-wrap">{note.body}</p>
                )}
                <p className="mt-1 text-sm text-muted">
                  {note.author.name} · <time dateTime={note.createdAt.toISOString()}>{sydneyDayLabel(note.createdAt)}</time>
                </p>
                <div className="mt-1 flex gap-3">
                  {canEditBuildingNote(role, note.authorId, userId) && !editing ? (
                    <Link
                      href={dashboardHref({ months: data.months, note: data.noteQuery, editNote: note.id })}
                      className="text-sm text-brand-blue hover:underline"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDeleteBuildingNote(role, note.authorId, userId) ? (
                    <form action={deleteBuildingNote}>
                      <input type="hidden" name="id" value={note.id} />
                      <ConfirmSubmit label="Delete" message="Delete this note?" className="text-sm text-danger hover:underline" />
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canAdd ? <BuildingNoteForm /> : null}
    </Card>
  );
}

function NumbersCard({
  data,
  canManage,
  editNumberId,
}: {
  data: DashboardData;
  canManage: boolean;
  editNumberId: string;
}) {
  return (
    <Card title="Useful numbers" id="dashboard-numbers">
      {data.numbers.length === 0 ? (
        <EmptyState>No numbers yet.</EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {data.numbers.map((entry) => {
            const editing = canManage && editNumberId === entry.id;
            return (
              <li key={entry.id} className="py-3 text-sm">
                {editing ? (
                  <UsefulNumberForm entry={entry} />
                ) : (
                  <>
                    <p className="font-medium">{entry.label}</p>
                    <p>
                      <a href={telHref(entry.number)} className="text-brand-blue hover:underline">
                        {entry.number}
                      </a>
                    </p>
                    {entry.notes ? <p className="mt-1 whitespace-pre-wrap text-muted">{entry.notes}</p> : null}
                  </>
                )}
                {canManage ? (
                  <div className="mt-1 flex gap-3">
                    {editing ? null : (
                      <Link href={dashboardHref({ months: data.months, note: data.noteQuery, editNumber: entry.id })} className="text-brand-blue hover:underline">
                        Edit
                      </Link>
                    )}
                    <form action={deleteUsefulNumber}>
                      <input type="hidden" name="id" value={entry.id} />
                      <ConfirmSubmit label="Delete" message="Delete this number?" className="text-danger hover:underline" />
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canManage ? <UsefulNumberForm /> : null}
    </Card>
  );
}

function ActivityCard({ data, className }: { data: DashboardData; className?: string }) {
  return (
    <Card title="Recent activity" id="dashboard-activity" className={className}>
      {data.activity.length === 0 ? (
        <EmptyState>No activity yet.</EmptyState>
      ) : (
        <div className="mt-3 space-y-4">
          {data.activity.map((group) => (
            <section key={group.iso} aria-label={group.label}>
              <h3 className="text-sm font-medium text-muted">{group.label}</h3>
              <ul className="mt-1 divide-y divide-line text-sm">
                {group.items.map((item) => (
                  <li key={item.id} className="py-2">
                    <Link href={item.href} className="text-brand-blue hover:underline">
                      {item.action}
                    </Link>
                    <p className="text-muted">{item.userName}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReportsCard({ data }: { data: DashboardData }) {
  return (
    <Card title="Management reports" id="dashboard-reports">
      {data.reports.length === 0 ? (
        <EmptyState>No reports yet</EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {data.reports.map((report) => (
            <li key={report.id} className="py-2">
              <p className="font-medium">{report.periodLabel}</p>
              <p className="text-muted">{report.createdLabel}</p>
              <Link
                href={report.href}
                className="text-brand-blue hover:underline"
                aria-label={`View ${report.formatLabel} for ${report.periodLabel}`}
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function dashboardHref(input: { months: number; note: string; editNote?: string; editNumber?: string }): string {
  const search = new URLSearchParams();
  if (input.months !== 3) search.set("months", String(input.months));
  if (input.note) search.set("note", input.note);
  if (input.editNote) search.set("editNote", input.editNote);
  if (input.editNumber) search.set("editNumber", input.editNumber);
  const query = search.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}
