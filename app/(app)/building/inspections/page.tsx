import type { Metadata } from "next";
import Link from "next/link";
import { SelectField, TextField } from "@/components/field";
import { parseDateOnly } from "@/lib/contractors";
import { listRuns, listTemplates, type RunListRow, type TemplateRow } from "@/lib/inspection-data";
import {
  formatInspectionType,
  formatSydneyDate,
  INSPECTION_TYPES,
  isInspectionTab,
  isInspectionType,
  type InspectionTab,
} from "@/lib/inspections";
import { formatDateTime } from "@/lib/cases";
import { requireUser } from "@/lib/data";
import { canManageInspectionTemplates } from "@/lib/roles";

export const metadata: Metadata = { title: "Inspections" };

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab: InspectionTab = isInspectionTab(first(params.tab)) ? (first(params.tab) as InspectionTab) : "templates";
  const q = first(params.q).slice(0, 120);
  const type = isInspectionType(first(params.type)) ? first(params.type) : "";
  const from = parseDateOnly(first(params.from));
  const to = parseDateOnly(first(params.to));
  const openFails = first(params.openFails) === "1";
  const canEditTemplates = canManageInspectionTemplates(user.role);

  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Inspections</h1>
        <p className="mt-4 text-muted">Select a building to see its inspections.</p>
      </section>
    );
  }

  const filters = { tab, q, type, from: from ? first(params.from) : "", to: to ? first(params.to) : "", openFails: tab === "completed" && openFails };
  const templates = tab === "templates" ? await listTemplates(user.selectedBuildingId, { q, type }) : [];
  const runs =
    tab === "templates"
      ? []
      : await listRuns(user.selectedBuildingId, {
          status: tab === "progress" ? "in_progress" : "completed",
          q: tab === "completed" ? q : "",
          type: tab === "completed" ? type : "",
          from: tab === "completed" ? from : null,
          to: tab === "completed" ? to : null,
          openFails: tab === "completed" && openFails,
        });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Inspections</h1>
        {canEditTemplates ? (
          <Link href="/building/inspections/templates/new" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            New template
          </Link>
        ) : null}
      </div>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Inspection tabs">
        {(["templates", "progress", "completed"] as const).map((item) => (
          <Link
            key={item}
            href={href({ ...filters, tab: item })}
            aria-current={tab === item ? "page" : undefined}
            className={`rounded-md px-3 py-1 text-sm ${tab === item ? "bg-brand-navy text-white" : "bg-card text-ink ring-1 ring-line"}`}
          >
            {tabLabel(item)}
          </Link>
        ))}
      </nav>

      {tab === "progress" ? null : (
        <form method="get" action="/building/inspections" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="tab" value={tab} />
          <TextField label="Search" name="q" type="search" defaultValue={q} placeholder="Name" />
          <SelectField label="Type" name="type" defaultValue={type}>
            <option value="">All</option>
            {INSPECTION_TYPES.map((item) => (
              <option key={item} value={item}>
                {formatInspectionType(item)}
              </option>
            ))}
          </SelectField>
          {tab === "completed" ? (
            <>
              <TextField label="Completed from" name="from" type="date" defaultValue={filters.from} />
              <TextField label="Completed to" name="to" type="date" defaultValue={filters.to} />
              <label className="flex items-center gap-2 pb-2 text-sm font-medium">
                <input type="checkbox" name="openFails" value="1" defaultChecked={filters.openFails} className="size-4 accent-brand-navy" />
                Failed items without a case
              </label>
            </>
          ) : null}
          <div className="flex items-end">
            <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
              Apply
            </button>
          </div>
        </form>
      )}

      {tab === "templates" ? <TemplateList rows={templates} canEdit={canEditTemplates} /> : null}
      {tab === "progress" ? <ProgressList rows={runs} /> : null}
      {tab === "completed" ? <CompletedList rows={runs} canEmail={canEditTemplates} /> : null}
    </section>
  );
}

function TemplateList({ rows, canEdit }: { rows: TemplateRow[]; canEdit: boolean }) {
  if (rows.length === 0) return <p className="mt-6 text-muted">No templates yet.</p>;
  return (
    <>
      <ul className="mt-6 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <TemplateName row={row} canEdit={canEdit} />
            <p className="mt-2 text-sm text-muted">
              {formatInspectionType(row.type)} · {row.itemCount} items
            </p>
            <p className="mt-1 text-sm text-muted">
              {row.completedRuns} completed · {row.activeRuns} in progress
            </p>
            <p className="mt-3">
              <StartLink row={row} />
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              {["Name", "Type", "Created", "Items", "Completed runs", "In-progress runs", ""].map((label) => (
                <th key={label || "action"} scope="col" className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <TemplateName row={row} canEdit={canEdit} />
                </td>
                <td className="px-4 py-3">{formatInspectionType(row.type)}</td>
                <td className="px-4 py-3">{formatSydneyDate(row.createdAt)}</td>
                <td className="px-4 py-3">{row.itemCount}</td>
                <td className="px-4 py-3">{row.completedRuns}</td>
                <td className="px-4 py-3">{row.activeRuns}</td>
                <td className="px-4 py-3">
                  <StartLink row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProgressList({ rows }: { rows: RunListRow[] }) {
  if (rows.length === 0) return <p className="mt-6 text-muted">No inspections in progress.</p>;
  return (
    <>
      <ul className="mt-6 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <RunName row={row} />
            <p className="mt-2 text-sm text-muted">
              {formatInspectionType(row.type)} · {row.inspectorName}
            </p>
            <p className="mt-1 text-sm">{row.answered} of {row.total} items answered</p>
            <p className="mt-3">
              <Link href={`/building/inspections/runs/${row.id}`} className="text-brand-blue hover:underline">
                Continue
              </Link>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              {["Name", "Type", "Inspector", "Started", "Progress", ""].map((label) => (
                <th key={label || "action"} scope="col" className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <RunName row={row} />
                </td>
                <td className="px-4 py-3">{formatInspectionType(row.type)}</td>
                <td className="px-4 py-3">{row.inspectorName}</td>
                <td className="px-4 py-3">{formatDateTime(row.startedAt)}</td>
                <td className="px-4 py-3">
                  {row.answered} of {row.total}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/building/inspections/runs/${row.id}`} className="text-brand-blue hover:underline">
                    Continue
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompletedList({ rows, canEmail }: { rows: RunListRow[]; canEmail: boolean }) {
  if (rows.length === 0) return <p className="mt-6 text-muted">No completed inspections.</p>;
  return (
    <>
      <ul className="mt-6 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <RunName row={row} />
            <p className="mt-2 text-sm text-muted">
              {formatInspectionType(row.type)} · {row.inspectorName}
            </p>
            <p className="mt-1 text-sm">{row.completedAt ? formatSydneyDate(row.completedAt) : ""}</p>
            <p className="mt-1 text-sm">{countLabel(row)}</p>
            <p className="mt-3 flex gap-4">
              <Link href={`/building/inspections/runs/${row.id}`} className="text-brand-blue hover:underline">
                View
              </Link>
              {canEmail ? (
                <Link href={`/building/inspections/runs/${row.id}/email`} className="text-brand-blue hover:underline">
                  Email report
                </Link>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              {["Name", "Type", "Inspector", "Completed", "Pass / Fail / NA", "", ""].map((label, index) => (
                <th key={`${label}-${index}`} scope="col" className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <RunName row={row} />
                </td>
                <td className="px-4 py-3">{formatInspectionType(row.type)}</td>
                <td className="px-4 py-3">{row.inspectorName}</td>
                <td className="px-4 py-3">{row.completedAt ? formatSydneyDate(row.completedAt) : ""}</td>
                <td className="px-4 py-3">{countLabel(row)}</td>
                <td className="px-4 py-3">
                  <Link href={`/building/inspections/runs/${row.id}`} className="text-brand-blue hover:underline">
                    View
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {canEmail ? (
                    <Link href={`/building/inspections/runs/${row.id}/email`} className="text-brand-blue hover:underline">
                      Email report
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TemplateName({ row, canEdit }: { row: TemplateRow; canEdit: boolean }) {
  if (!canEdit) return <span className="font-medium">{row.name}</span>;
  return (
    <Link href={`/building/inspections/templates/${row.id}`} className="font-medium text-brand-blue hover:underline">
      {row.name}
    </Link>
  );
}

function StartLink({ row }: { row: TemplateRow }) {
  return (
    <Link href={`/building/inspections/templates/${row.id}/start`} className="text-brand-blue hover:underline" aria-label={`Start inspection ${row.name}`}>
      Start inspection
    </Link>
  );
}

function RunName({ row }: { row: RunListRow }) {
  const apartment = row.apartmentNumber ? ` · Apartment ${row.apartmentNumber}` : "";
  return (
    <Link href={`/building/inspections/runs/${row.id}`} className="font-medium text-brand-blue hover:underline">
      {row.name}
      {apartment}
    </Link>
  );
}

function countLabel(row: RunListRow): string {
  return `${row.pass} pass · ${row.fail} fail · ${row.na} NA`;
}

function tabLabel(tab: InspectionTab): string {
  if (tab === "templates") return "Templates";
  if (tab === "progress") return "In progress";
  return "Completed";
}

function href(filters: { tab: InspectionTab; q: string; type: string; from: string; to: string; openFails: boolean }): string {
  const params = new URLSearchParams();
  if (filters.tab !== "templates") params.set("tab", filters.tab);
  if (filters.tab !== "progress" && filters.q) params.set("q", filters.q);
  if (filters.tab !== "progress" && filters.type) params.set("type", filters.type);
  if (filters.tab === "completed" && filters.from) params.set("from", filters.from);
  if (filters.tab === "completed" && filters.to) params.set("to", filters.to);
  if (filters.tab === "completed" && filters.openFails) params.set("openFails", "1");
  const query = params.toString();
  return query ? `/building/inspections?${query}` : "/building/inspections";
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
