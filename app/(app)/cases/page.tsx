import type { Metadata } from "next";
import Link from "next/link";
import { setCasesStatus, toggleCaseStar } from "@/app/actions/cases";
import { CaseBoard } from "@/components/case-board";
import { CaseTypes } from "@/components/case-types";
import { SelectAll } from "@/components/case-select";
import { FilesMark } from "@/components/files-mark";
import { WorkOrderMark } from "@/components/work-order-mark";
import { SelectField, TextField } from "@/components/field";
import { PriorityBadge } from "@/components/priority-badge";
import { parseDateOnly } from "@/lib/contractors";
import {
  CASE_PRIORITIES,
  CASE_SORTS,
  CASE_STATUSES,
  PAGE_SIZE,
  formatCalendarDate,
  formatIsoDate,
  formatPriority,
  formatStatus,
  parseCaseSort,
  parsePage,
  parseSortDir,
  type CaseSort,
} from "@/lib/cases";
import {
  listApprovedCompanies,
  listCaseBoard,
  listCaseTypes,
  listCases,
  requireUser,
  type CaseRow,
} from "@/lib/data";
import { canEditCases, canManageCaseTypes } from "@/lib/roles";

export const metadata: Metadata = { title: "Cases" };

type Filters = {
  q: string;
  typeId: string;
  priority: string;
  status: string;
  companyId: string;
  from: string;
  to: string;
  starred: boolean;
  sort: CaseSort;
  dir: "asc" | "desc";
  page: number;
  view: "list" | "board";
};

const SORT_LABELS: Record<CaseSort, string> = {
  number: "Case #",
  start: "Start date",
  subject: "Subject",
  type: "Type",
  priority: "Priority",
  status: "Status",
};

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = readFilters(params);
  const canEdit = canEditCases(user.role);
  const canManageTypes = canManageCaseTypes(user.role);

  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Cases</h1>
        <p className="mt-4 text-muted">Select a building to see its cases.</p>
      </section>
    );
  }

  const buildingId = user.selectedBuildingId;
  const [types, companies] = await Promise.all([listCaseTypes(), listApprovedCompanies()]);
  const typeId = types.some((type) => type.id === filters.typeId) ? filters.typeId : "";
  const companyId = companies.some((company) => company.id === filters.companyId) ? filters.companyId : "";
  const priority = CASE_PRIORITIES.includes(filters.priority as (typeof CASE_PRIORITIES)[number]) ? filters.priority : "";
  const status = CASE_STATUSES.includes(filters.status as (typeof CASE_STATUSES)[number]) ? filters.status : "";
  const fromDate = filters.from ? parseDateOnly(filters.from) : null;
  const toDate = filters.to ? parseDateOnly(filters.to) : null;
  const active: Filters = {
    ...filters,
    typeId,
    companyId,
    priority,
    status,
    from: fromDate ? filters.from : "",
    to: toDate ? filters.to : "",
  };
  const query = {
    buildingId,
    userId: user.id,
    q: active.q,
    typeId: active.typeId,
    priority: active.priority,
    status: active.status,
    companyId: active.companyId,
    from: fromDate,
    to: toDate,
    starred: active.starred,
  };
  const listed = active.view === "board" ? null : await listCases({ ...query, sort: active.sort, dir: active.dir, page: active.page });
  const board = active.view === "board" ? await listCaseBoard(query) : null;
  const total = listed?.total ?? board?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil((listed?.total ?? 0) / PAGE_SIZE));
  const filtered = Boolean(active.q || active.typeId || active.priority || active.status || active.companyId || active.from || active.to || active.starred);
  const returnTo = casesHref(active);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Cases</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-line bg-card p-1 text-sm">
            <ViewLink href={casesHref({ ...active, view: "list", page: 1 })} current={active.view === "list"}>
              List
            </ViewLink>
            <ViewLink href={casesHref({ ...active, view: "board", page: 1 })} current={active.view === "board"}>
              Board
            </ViewLink>
          </div>
          {canEdit ? (
            <Link href="/cases/new" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
              New case
            </Link>
          ) : null}
        </div>
      </div>

      <form method="get" action="/cases" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {active.view === "board" ? <input type="hidden" name="view" value="board" /> : null}
        <TextField label="Search cases" name="q" type="search" defaultValue={active.q} placeholder="Number, subject, or description" />
        <SelectField label="Type" name="type" defaultValue={active.typeId}>
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Priority" name="priority" defaultValue={active.priority}>
          <option value="">All priorities</option>
          {CASE_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {formatPriority(item)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" name="status" defaultValue={active.status}>
          <option value="">All statuses</option>
          {CASE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {formatStatus(item)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Contractor" name="contractor" defaultValue={active.companyId}>
          <option value="">All contractors</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Start from" name="from" type="date" defaultValue={active.from} />
        <TextField label="Start to" name="to" type="date" defaultValue={active.to} />
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 pb-2 text-sm font-medium">
            <input type="checkbox" name="starred" value="1" defaultChecked={active.starred} className="size-4 accent-brand-navy" />
            Starred only
          </label>
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            Apply
          </button>
        </div>
      </form>
      {filtered ? (
        <Link href={active.view === "board" ? "/cases?view=board" : "/cases"} className="mt-3 inline-block text-sm text-brand-blue hover:underline">
          Clear filters
        </Link>
      ) : null}

      <p className="mt-4 text-sm text-muted">{total === 1 ? "1 case" : `${total} cases`}</p>

      {active.view === "board" && board ? (
        board.length === 0 && filtered ? (
          <p className="mt-4 text-muted">No cases match.</p>
        ) : (
          <CaseBoard rows={board} returnTo={returnTo} />
        )
      ) : null}

      {active.view === "list" && listed ? (
        listed.rows.length === 0 ? (
          <p className="mt-4 text-muted">{filtered ? "No cases match." : "No cases yet."}</p>
        ) : (
          <CaseResults rows={listed.rows} filters={active} returnTo={returnTo} canEdit={canEdit} />
        )
      ) : null}

      {active.view === "list" && totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {active.page} of {totalPages}
          </p>
          <div className="flex gap-3">
            {active.page > 1 ? (
              <Link href={casesHref({ ...active, page: active.page - 1 })} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {active.page < totalPages ? (
              <Link href={casesHref({ ...active, page: active.page + 1 })} className="text-brand-blue hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-muted">Next</span>
            )}
          </div>
        </div>
      ) : null}

      {canManageTypes ? (
        <CaseTypes types={types.map((type) => ({ id: type.id, name: type.name, caseCount: type._count.cases }))} />
      ) : null}
    </section>
  );
}

function CaseResults({
  rows,
  filters,
  returnTo,
  canEdit,
}: {
  rows: CaseRow[];
  filters: Filters;
  returnTo: string;
  canEdit: boolean;
}) {
  return (
    <>
      {canEdit ? (
        <form id="case-bulk" action={setCasesStatus} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="flex items-center gap-2 pb-2 text-sm md:hidden">
            <SelectAll />
            Select all
          </label>
          <SelectField label="Change status" name="status" defaultValue="new">
            {CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            Update selected
          </button>
        </form>
      ) : null}
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {canEdit ? <CaseCheck number={row.number} /> : null}
                <Link href={`/cases/${row.number}`} className="font-medium text-brand-blue hover:underline">
                  #{row.number} {row.subject}
                </Link>
              </div>
              <StarButton row={row} returnTo={returnTo} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {formatCalendarDate(row.startDate)} · {row.typeName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={row.priority} />
              <span className="text-sm">{formatStatus(row.status)}</span>
              {row.hasFiles ? <FilesMark /> : null}
              {row.hasWorkOrders ? <WorkOrderMark /> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{canEdit ? <SelectAll /> : null}</th>
              {CASE_SORTS.map((sort) => (
                <th key={sort} className="px-4 py-3 font-medium" aria-sort={filters.sort === sort ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <Link href={sortHref(filters, sort)} className="hover:text-brand-blue">
                    {SORT_LABELS[sort]}
                    {filters.sort === sort ? (filters.dir === "asc" ? " ↑" : " ↓") : ""}
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Files</span>
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Star</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{canEdit ? <CaseCheck number={row.number} /> : null}</td>
                <td className="px-4 py-3">
                  <Link href={`/cases/${row.number}`} className="font-medium text-brand-blue hover:underline">
                    #{row.number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <time dateTime={formatIsoDate(row.startDate)}>{formatCalendarDate(row.startDate)}</time>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/cases/${row.number}`} className="text-brand-blue hover:underline">
                    {row.subject}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.typeName}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={row.priority} />
                </td>
                <td className="px-4 py-3">{formatStatus(row.status)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    {row.hasFiles ? <FilesMark /> : null}
                    {row.hasWorkOrders ? <WorkOrderMark /> : null}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StarButton row={row} returnTo={returnTo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CaseCheck({ number }: { number: number }) {
  return <input form="case-bulk" type="checkbox" name="number" value={number} aria-label={`Select case ${number}`} className="size-4 accent-brand-navy" />;
}

function StarButton({ row, returnTo }: { row: CaseRow; returnTo: string }) {
  return (
    <form action={toggleCaseStar}>
      <input type="hidden" name="number" value={row.number} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-pressed={row.starred}
        aria-label={row.starred ? `Unstar case ${row.number}` : `Star case ${row.number}`}
        className={`text-lg leading-none ${row.starred ? "text-amber-500" : "text-muted"}`}
      >
        {row.starred ? "★" : "☆"}
      </button>
    </form>
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

function sortHref(filters: Filters, sort: CaseSort): string {
  const dir = filters.sort !== sort ? (sort === "number" || sort === "start" ? "desc" : "asc") : filters.dir === "asc" ? "desc" : "asc";
  return casesHref({ ...filters, sort, dir, page: 1, view: "list" });
}

function casesHref(input: Filters): string {
  const search = new URLSearchParams();
  if (input.view === "board") search.set("view", "board");
  if (input.q) search.set("q", input.q);
  if (input.typeId) search.set("type", input.typeId);
  if (input.priority) search.set("priority", input.priority);
  if (input.status) search.set("status", input.status);
  if (input.companyId) search.set("contractor", input.companyId);
  if (input.from) search.set("from", input.from);
  if (input.to) search.set("to", input.to);
  if (input.starred) search.set("starred", "1");
  if (input.sort !== "number") search.set("sort", input.sort);
  if (input.dir !== "desc") search.set("dir", input.dir);
  if (input.view !== "board" && input.page > 1) search.set("page", String(input.page));
  const query = search.toString();
  return query ? `/cases?${query}` : "/cases";
}

function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  return {
    q: first(params.q).slice(0, 120),
    typeId: first(params.type),
    priority: first(params.priority),
    status: first(params.status),
    companyId: first(params.contractor),
    from: first(params.from),
    to: first(params.to),
    starred: first(params.starred) === "1",
    sort: parseCaseSort(first(params.sort)),
    dir: parseSortDir(first(params.dir)),
    page: parsePage(first(params.page)),
    view: first(params.view) === "board" ? "board" : "list",
  };
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
