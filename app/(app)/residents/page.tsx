import type { Metadata } from "next";
import Link from "next/link";
import { ApartmentDialog } from "@/components/apartment-dialog";
import { SelectField, TextField } from "@/components/field";
import { listApartments, listResidents, requireUser, type ApartmentRow, type ResidentRow } from "@/lib/data";
import {
  PAGE_SIZE,
  formatLotNumber,
  formatOccupancy,
  formatResidentType,
  initials,
  parsePage,
  parseResidentTab,
  parseResidentType,
  residentName,
  type ResidentTab,
} from "@/lib/residents";
import { canManageResidents } from "@/lib/roles";

export const metadata: Metadata = { title: "Residents" };

const TABS: { id: ResidentTab; label: string }[] = [
  { id: "residents", label: "Residents" },
  { id: "apartments", label: "Apartments" },
];

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseResidentTab(first(params.tab));
  const q = first(params.q).slice(0, 120);
  const type = parseResidentType(first(params.type));
  const page = parsePage(first(params.page));
  const canManage = canManageResidents(user.role);
  const buildingId = user.selectedBuildingId;

  if (!buildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Residents</h1>
        <p className="mt-4 text-muted">Select a building to see its apartments and residents.</p>
      </section>
    );
  }

  const residents = tab === "residents" ? await listResidents({ buildingId, q, type, page }) : null;
  const apartments = tab === "apartments" ? await listApartments(buildingId) : null;
  const totalPages = residents ? Math.max(1, Math.ceil(residents.total / PAGE_SIZE)) : 1;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Residents</h1>
        {canManage && tab === "residents" ? (
          <Link
            href="/residents/new"
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue"
          >
            New resident
          </Link>
        ) : null}
        {canManage && tab === "apartments" ? <ApartmentDialog /> : null}
      </div>

      <nav aria-label="Resident views" className="mt-6 flex flex-wrap gap-x-1 border-b border-line">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Link
              key={item.id}
              href={residentsHref({ tab: item.id })}
              aria-current={active ? "page" : undefined}
              className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
                active ? "border-brand-navy text-brand-navy" : "border-transparent text-muted hover:text-brand-blue"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "residents" && residents ? (
        <>
          <form
            method="get"
            action="/residents"
            className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-end"
          >
            <TextField
              label="Search residents"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name, email, phone, or apartment"
            />
            <SelectField label="Resident type" name="type" defaultValue={type}>
              <option value="">All</option>
              <option value="owner">Owner</option>
              <option value="tenant">Tenant</option>
              <option value="other">Other</option>
            </SelectField>
            <button
              type="submit"
              className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue"
            >
              Apply
            </button>
          </form>
          {q || type ? (
            <Link href="/residents" className="mt-3 inline-block text-sm text-brand-blue hover:underline">
              Clear filters
            </Link>
          ) : null}
          <p className="mt-4 text-sm text-muted">{residents.total === 1 ? "1 resident" : `${residents.total} residents`}</p>
          {residents.rows.length === 0 ? (
            <p className="mt-4 text-muted">No residents match.</p>
          ) : (
            <ResidentResults rows={residents.rows} />
          )}
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p>
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-3">
                {page > 1 ? (
                  <Link href={residentsHref({ tab, q, type, page: page - 1 })} className="text-brand-blue hover:underline">
                    Previous
                  </Link>
                ) : (
                  <span className="text-muted">Previous</span>
                )}
                {page < totalPages ? (
                  <Link href={residentsHref({ tab, q, type, page: page + 1 })} className="text-brand-blue hover:underline">
                    Next
                  </Link>
                ) : (
                  <span className="text-muted">Next</span>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "apartments" && apartments ? (
        <>
          <p className="mt-4 text-sm text-muted">
            {apartments.length === 1 ? "1 apartment" : `${apartments.length} apartments`}
          </p>
          {apartments.length === 0 ? (
            <p className="mt-4 text-muted">No apartments yet.</p>
          ) : (
            <ApartmentResults rows={apartments} />
          )}
        </>
      ) : null}
    </section>
  );
}

function ResidentResults({ rows }: { rows: ResidentRow[] }) {
  return (
    <>
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <Initials firstName={row.firstName} lastName={row.lastName} />
              <div className="min-w-0">
                <p className="font-medium">
                  <ResidentLink row={row} />
                  {row.primaryContact ? <PrimaryStar /> : null}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Lot {formatLotNumber(row.lotNumber)} · Apartment {row.apartmentNumber}
                </p>
                <p className="mt-1 text-sm">{formatResidentType(row.type)}</p>
                <p className="mt-1 text-sm">{blank(row.phone)}</p>
                <p className="text-sm">{blank(row.mobile)}</p>
                <p className="text-sm break-all">{blank(row.email)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Lot number</th>
              <th className="px-4 py-3 font-medium">Apartment</th>
              <th className="px-4 py-3 font-medium">Resident type</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Primary contact</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Initials firstName={row.firstName} lastName={row.lastName} />
                    <ResidentLink row={row} />
                  </span>
                </td>
                <td className="px-4 py-3">{formatLotNumber(row.lotNumber)}</td>
                <td className="px-4 py-3">
                  <Link href={`/residents/apartments/${row.apartmentId}`} className="text-brand-blue hover:underline">
                    {row.apartmentNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatResidentType(row.type)}</td>
                <td className="px-4 py-3">{blank(row.phone)}</td>
                <td className="px-4 py-3">{blank(row.mobile)}</td>
                <td className="px-4 py-3 break-all">{blank(row.email)}</td>
                <td className="px-4 py-3">{row.primaryContact ? <PrimaryStar /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ApartmentResults({ rows }: { rows: ApartmentRow[] }) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/residents/apartments/${row.id}`}
            className="block rounded-xl border border-line bg-card p-4 hover:border-brand-blue"
          >
            <p className="font-serif text-2xl text-brand-navy">{row.number}</p>
            <p className="mt-1 text-sm text-muted">Lot {formatLotNumber(row.lotNumber)}</p>
            <p className="mt-2 text-sm">{row.residentCount === 1 ? "1 resident" : `${row.residentCount} residents`}</p>
            {row.occupancy === "investment" ? (
              <p className="mt-2 text-sm font-medium text-brand-blue">{formatOccupancy(row.occupancy)}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ResidentLink({ row }: { row: ResidentRow }) {
  return (
    <Link href={`/residents/apartments/${row.apartmentId}`} className="font-medium text-brand-blue hover:underline">
      {residentName(row.firstName, row.lastName)}
    </Link>
  );
}

function Initials({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-medium text-white"
    >
      {initials(firstName, lastName)}
    </span>
  );
}

function PrimaryStar() {
  return (
    <span title="Primary contact" aria-label="Primary contact" className="ml-2 text-brand-navy">
      ★
    </span>
  );
}

function residentsHref(input: { tab: ResidentTab; q?: string; type?: string; page?: number }): string {
  const search = new URLSearchParams();
  if (input.tab === "apartments") return "/residents?tab=apartments";
  if (input.q) search.set("q", input.q);
  if (input.type) search.set("type", input.type);
  if (input.page && input.page > 1) search.set("page", String(input.page));
  const query = search.toString();
  return query ? `/residents?${query}` : "/residents";
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function blank(value: string | null): string {
  return value ? value : "—";
}
