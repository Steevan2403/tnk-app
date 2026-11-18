import type { Metadata } from "next";
import Link from "next/link";
import { SelectField, TextField } from "@/components/field";
import { formatCalendarDate } from "@/lib/cases";
import { formatIsoDate } from "@/lib/contractors";
import { requireUser } from "@/lib/data";
import {
  FREQUENCIES,
  MAINTENANCE_TABS,
  PAGE_SIZE,
  formatFrequency,
  isFrequency,
  isMaintenanceTab,
  timelineMonths,
  sydneyToday,
  type MaintenanceTab,
} from "@/lib/maintenance";
import { listMaintenance, maintenanceFilterOptions, type MaintenanceRow } from "@/lib/maintenance-data";
import { canManageMaintenance } from "@/lib/roles";

export const metadata: Metadata = { title: "Maintenance" };

type Filters = {
  tab: MaintenanceTab;
  q: string;
  frequency: string;
  companyId: string;
  categoryId: string;
  page: number;
  view: "list" | "timeline";
};

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const filters = readFilters(await searchParams);
  const canManage = canManageMaintenance(user.role);

  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Maintenance</h1>
        <p className="mt-4 text-muted">Select a building to see its maintenance.</p>
      </section>
    );
  }

  const options = await maintenanceFilterOptions(user.selectedBuildingId);
  const active: Filters = {
    ...filters,
    frequency: isFrequency(filters.frequency) ? filters.frequency : "",
    companyId: options.companies.some((company) => company.id === filters.companyId) ? filters.companyId : "",
    categoryId: options.categories.some((category) => category.id === filters.categoryId) ? filters.categoryId : "",
  };
  const listed = await listMaintenance(user.selectedBuildingId, active);
  const totalPages = Math.max(1, Math.ceil(listed.total / PAGE_SIZE));
  const months = timelineMonths(sydneyToday());

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Maintenance</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-line bg-card p-1 text-sm">
            <ViewLink href={href({ ...active, view: "list", page: 1 })} current={active.view === "list"}>
              List
            </ViewLink>
            <ViewLink href={href({ ...active, view: "timeline", page: 1 })} current={active.view === "timeline"}>
              Timeline
            </ViewLink>
          </div>
          {canManage ? (
            <Link href="/maintenance/new" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
              New maintenance
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Maintenance tabs">
        {MAINTENANCE_TABS.map((tab) => (
          <Link
            key={tab}
            href={href({ ...active, tab, page: 1 })}
            aria-current={active.tab === tab ? "page" : undefined}
            className={`rounded-md px-3 py-1 text-sm ${active.tab === tab ? "bg-brand-navy text-white" : "bg-card text-ink ring-1 ring-line"}`}
          >
            {tabLabel(tab)}
          </Link>
        ))}
      </nav>

      <form method="get" action="/maintenance" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="tab" value={active.tab} />
        {active.view === "timeline" ? <input type="hidden" name="view" value="timeline" /> : null}
        <TextField label="Search maintenance" name="q" type="search" defaultValue={active.q} placeholder="Subject or description" />
        <SelectField label="Contractor" name="contractor" defaultValue={active.companyId}>
          <option value="">All contractors</option>
          {options.companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Asset category" name="category" defaultValue={active.categoryId}>
          <option value="">All categories</option>
          {options.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Frequency" name="frequency" defaultValue={active.frequency}>
          <option value="">All frequencies</option>
          {FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {formatFrequency(frequency, null)}
            </option>
          ))}
        </SelectField>
        <div className="flex items-end">
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            Apply
          </button>
        </div>
      </form>

      <p className="mt-4 text-sm text-muted">
        {listed.total === 0 ? "No maintenance on this tab." : `${listed.total} ${listed.total === 1 ? "event" : "events"}`}
      </p>

      {active.view === "timeline" ? (
        <Timeline rows={listed.rows} months={months} canManage={canManage} />
      ) : (
        <EventList rows={listed.rows} canManage={canManage} />
      )}

      {totalPages > 1 ? (
        <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Pages">
          {Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return (
              <Link
                key={page}
                href={href({ ...active, page })}
                aria-current={page === active.page ? "page" : undefined}
                className={`rounded px-3 py-1 ${page === active.page ? "bg-brand-navy text-white" : "bg-card ring-1 ring-line"}`}
              >
                {page}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}

function EventList({ rows, canManage }: { rows: MaintenanceRow[]; canManage: boolean }) {
  if (rows.length === 0) return null;
  return (
    <>
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <Subject row={row} canManage={canManage} />
            <p className="mt-2 text-sm text-muted">
              {formatFrequency(row.frequency, row.intervalMonths)} · Next due {row.nextDue ? formatCalendarDate(row.nextDue) : "None"}
            </p>
            <p className="mt-1 text-sm">{row.companyNames.join(", ") || "No contractor"}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              {["Subject", "Start date", "End date", "Frequency", "Contractor(s)", "Asset(s)", "Documents", "Auto email", "Next due"].map(
                (label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Subject row={row} canManage={canManage} />
                </td>
                <td className="px-4 py-3">
                  <time dateTime={formatIsoDate(row.startDate)}>{formatCalendarDate(row.startDate)}</time>
                </td>
                <td className="px-4 py-3">{row.endDate ? formatCalendarDate(row.endDate) : "No end"}</td>
                <td className="px-4 py-3">{formatFrequency(row.frequency, row.intervalMonths)}</td>
                <td className="px-4 py-3">{row.companyNames.join(", ") || "—"}</td>
                <td className="px-4 py-3">{row.assetNames.join(", ") || "—"}</td>
                <td className="px-4 py-3">{row.documentCount}</td>
                <td className="px-4 py-3">{row.remindContractor ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{row.nextDue ? formatCalendarDate(row.nextDue) : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Timeline({
  rows,
  months,
  canManage,
}: {
  rows: MaintenanceRow[];
  months: { key: string; label: string }[];
  canManage: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid min-w-[72rem] gap-px bg-line" style={{ gridTemplateColumns: `14rem repeat(12, minmax(3.5rem, 1fr))` }}>
        <div className="bg-card px-3 py-2 text-sm font-medium text-muted">Event</div>
        {months.map((month) => (
          <div key={month.key} className="bg-card px-2 py-2 text-center text-xs font-medium text-muted">
            {month.label}
          </div>
        ))}
        {rows.map((row) => (
          <TimelineRow key={row.id} row={row} months={months} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  row,
  months,
  canManage,
}: {
  row: MaintenanceRow;
  months: { key: string; label: string }[];
  canManage: boolean;
}) {
  return (
    <>
      <div className="bg-card px-3 py-3 text-sm">
        <Subject row={row} canManage={canManage} />
      </div>
      {months.map((month) => {
        const days = row.upcomingDates.filter((iso) => iso.slice(0, 7) === month.key).map((iso) => Number(iso.slice(8)));
        return (
          <div key={month.key} className="bg-card px-1 py-3 text-center text-xs text-brand-navy">
            {days.length > 0 ? days.join(" ") : ""}
          </div>
        );
      })}
    </>
  );
}

function Subject({ row, canManage }: { row: MaintenanceRow; canManage: boolean }) {
  if (!canManage) return <span className="font-medium">{row.subject}</span>;
  return (
    <Link href={`/maintenance/${row.id}/edit`} className="font-medium text-brand-blue hover:underline">
      {row.subject}
    </Link>
  );
}

function ViewLink({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded px-3 py-1 font-medium ${current ? "bg-brand-navy text-white" : "text-ink hover:text-brand-blue"}`}
    >
      {children}
    </Link>
  );
}

function tabLabel(tab: MaintenanceTab): string {
  if (tab === "overdue") return "Overdue";
  if (tab === "completed") return "Completed";
  return "Active";
}

function href(input: Filters): string {
  const search = new URLSearchParams();
  if (input.tab !== "active") search.set("tab", input.tab);
  if (input.view === "timeline") search.set("view", "timeline");
  if (input.q) search.set("q", input.q);
  if (input.frequency) search.set("frequency", input.frequency);
  if (input.companyId) search.set("contractor", input.companyId);
  if (input.categoryId) search.set("category", input.categoryId);
  if (input.page > 1) search.set("page", String(input.page));
  const query = search.toString();
  return query ? `/maintenance?${query}` : "/maintenance";
}

function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  const tab = first(params.tab);
  const page = Number(first(params.page));
  return {
    tab: isMaintenanceTab(tab) ? tab : "active",
    q: first(params.q).slice(0, 120),
    frequency: first(params.frequency),
    companyId: first(params.contractor),
    categoryId: first(params.category),
    page: Number.isInteger(page) && page > 0 && page < 10000 ? page : 1,
    view: first(params.view) === "timeline" ? "timeline" : "list",
  };
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
