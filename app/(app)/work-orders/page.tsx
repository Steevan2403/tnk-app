import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, StatusBadge } from "@/components/ui";
import { WorkOrderStatusSelect } from "@/components/work-order-status";
import { SelectField, TextField } from "@/components/field";
import { parsePage } from "@/lib/cases";
import { formatDateTime } from "@/lib/contractors";
import { listWorkOrderCompanies, listWorkOrders, requireUser } from "@/lib/data";
import { canCancelWorkOrders, canSendWorkOrders } from "@/lib/roles";
import {
  PAGE_SIZE,
  WORK_ORDER_STATUSES,
  formatWorkOrderStatus,
  isWorkOrderStatus,
  sentRange,
} from "@/lib/work-orders";

export const metadata: Metadata = { title: "Work Orders" };

type Filters = {
  q: string;
  status: string;
  companyId: string;
  from: string;
  to: string;
  page: number;
};

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = readFilters(params);
  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Work Orders</h1>
        <p className="mt-4 text-muted">Select a building to see its work orders.</p>
      </section>
    );
  }

  const companies = await listWorkOrderCompanies();
  const companyId = companies.some((company) => company.id === filters.companyId) ? filters.companyId : "";
  const status = isWorkOrderStatus(filters.status) ? filters.status : "";
  const range = sentRange(filters.from, filters.to);
  const active: Filters = {
    ...filters,
    companyId,
    status,
    from: range.from ? filters.from : "",
    to: range.to ? filters.to : "",
  };
  const listed = await listWorkOrders({
    buildingId: user.selectedBuildingId,
    q: active.q,
    status: active.status,
    companyId: active.companyId,
    sentFrom: range.from,
    sentTo: range.to,
    page: active.page,
  });
  const totalPages = Math.max(1, Math.ceil(listed.total / PAGE_SIZE));
  const page = Math.min(active.page, totalPages);
  const rows =
    page === active.page
      ? listed.rows
      : (
          await listWorkOrders({
            buildingId: user.selectedBuildingId,
            q: active.q,
            status: active.status,
            companyId: active.companyId,
            sentFrom: range.from,
            sentTo: range.to,
            page,
          })
        ).rows;
  const filtered = Boolean(active.q || active.status || active.companyId || active.from || active.to);
  const returnTo = workOrdersHref({ ...active, page });
  const canChange = canSendWorkOrders(user.role);
  const canCancel = canCancelWorkOrders(user.role);

  return (
    <section>
      <h1 className="font-serif text-3xl">Work Orders</h1>
      <form method="get" className="filter-card mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextField label="Search work orders" name="q" type="search" defaultValue={active.q} placeholder="Number, subject, or contractor" />
        <SelectField label="Status" name="status" defaultValue={active.status}>
          <option value="">All statuses</option>
          {WORK_ORDER_STATUSES.map((item) => (
            <option key={item} value={item}>
              {formatWorkOrderStatus(item)}
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
        <TextField label="Sent from" name="from" type="date" defaultValue={active.from} />
        <TextField label="Sent to" name="to" type="date" defaultValue={active.to} />
        <div className="flex items-end">
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            Apply
          </button>
        </div>
      </form>
      {filtered ? (
        <Link href="/work-orders" className="mt-3 inline-block text-sm text-brand-blue hover:underline">
          Clear filters
        </Link>
      ) : null}
      <p className="mt-4 text-sm text-muted">{listed.total === 1 ? "1 work order" : `${listed.total} work orders`}</p>
      {rows.length === 0 ? (
        <EmptyState>{filtered ? "No work orders match." : "No work orders yet."}</EmptyState>
      ) : (
        <>
          <ul className="mt-4 space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/work-orders/${row.id}`} className="font-medium text-brand-blue hover:underline">
                    {row.number}
                  </Link>
                  {row.onSiteName ? <p className="text-sm text-brand-green">On site · {row.onSiteName}</p> : null}
                  <RowLinks row={row} />
                </div>
                <p className="mt-2">{row.caseSubject}</p>
                <p className="mt-1 text-sm text-muted">
                  {row.companyName} · {row.contactName}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {row.caseType} · {formatDateTime(row.sentAt)} · {row.sentByName}
                </p>
                <div className="mt-3">
                  {canChange ? (
                    <WorkOrderStatusSelect id={row.id} number={row.number} status={row.status} canCancel={canCancel} returnTo={returnTo} />
                  ) : (
                    <StatusBadge status={row.status} label={formatWorkOrderStatus(row.status)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden table-card overflow-x-auto rounded-xl border border-line bg-card md:block">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Work order</th>
                  <th className="px-4 py-3 font-medium">Case subject</th>
                  <th className="px-4 py-3 font-medium">Sent to</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Case type</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Sent by</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">PDF and email</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/work-orders/${row.id}`} className="font-medium text-brand-blue hover:underline">
                        {row.number}
                      </Link>
                      {row.onSiteName ? <p className="text-sm text-brand-green">On site · {row.onSiteName}</p> : null}
                    </td>
                    <td className="px-4 py-3">{row.caseSubject}</td>
                    <td className="px-4 py-3">{row.companyName}</td>
                    <td className="px-4 py-3">{row.contactName}</td>
                    <td className="px-4 py-3">
                      {canChange ? (
                        <WorkOrderStatusSelect
                          id={row.id}
                          number={row.number}
                          status={row.status}
                          canCancel={canCancel}
                          returnTo={returnTo}
                        />
                      ) : (
                        <StatusBadge status={row.status} label={formatWorkOrderStatus(row.status)} />
                      )}
                    </td>
                    <td className="px-4 py-3">{row.caseType}</td>
                    <td className="px-4 py-3">{formatDateTime(row.sentAt)}</td>
                    <td className="px-4 py-3">{row.sentByName}</td>
                    <td className="px-4 py-3">
                      <RowLinks row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={workOrdersHref({ ...active, page: page - 1 })} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {page < totalPages ? (
              <Link href={workOrdersHref({ ...active, page: page + 1 })} className="text-brand-blue hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-muted">Next</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RowLinks({ row }: { row: { id: string; number: string } }) {
  return (
    <span className="inline-flex items-center gap-3">
      <a href={`/api/work-orders/${row.id}/pdf`} aria-label={`View PDF for ${row.number}`} className="text-brand-blue hover:text-brand-navy" title="View PDF">
        <PdfIcon />
      </a>
      <Link href={`/work-orders/${row.id}/email`} aria-label={`View email for ${row.number}`} className="text-brand-blue hover:text-brand-navy" title="View email">
        <EmailIcon />
      </Link>
    </span>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M3.5 1.5h6.2L13 5v9.5H3.5v-13z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 1.5V5.2H13" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.2 11.2h5.6M5.2 8.8h5.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 4.2 8 8.5 14 4.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function workOrdersHref(input: Filters): string {
  const search = new URLSearchParams();
  if (input.q) search.set("q", input.q);
  if (input.status) search.set("status", input.status);
  if (input.companyId) search.set("contractor", input.companyId);
  if (input.from) search.set("from", input.from);
  if (input.to) search.set("to", input.to);
  if (input.page > 1) search.set("page", String(input.page));
  const query = search.toString();
  return query ? `/work-orders?${query}` : "/work-orders";
}

function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  return {
    q: first(params.q).slice(0, 120),
    status: first(params.status),
    companyId: first(params.contractor),
    from: first(params.from),
    to: first(params.to),
    page: parsePage(first(params.page)),
  };
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
