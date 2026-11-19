import type { Metadata } from "next";
import Link from "next/link";
import { approveCompany } from "@/app/actions/contractors";
import { ContractorCategories } from "@/components/contractor-categories";
import { EmptyState } from "@/components/ui";
import { SelectField, TextField } from "@/components/field";
import { InsuranceBadge } from "@/components/insurance-badge";
import {
  listContractorCategories,
  listContractorCompanyOptions,
  listContractors,
  requireUser,
  type CompanyRow,
  type ContactRow,
} from "@/lib/data";
import { PAGE_SIZE, parsePage, parseTab, type ContractorTab } from "@/lib/contractors";
import { canManageContractors } from "@/lib/roles";

export const metadata: Metadata = { title: "Contractors" };

const TABS: { id: ContractorTab; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "companies", label: "Companies" },
  { id: "expired", label: "Expired insurance" },
  { id: "pending", label: "Pending approval" },
];

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseTab(first(params.tab));
  const q = first(params.q).slice(0, 120);
  const companyId = first(params.company);
  const categoryId = first(params.category);
  const page = parsePage(first(params.page));
  const canManage = canManageContractors(user.role);

  const [categories, companies, result] = await Promise.all([
    listContractorCategories(),
    listContractorCompanyOptions(),
    listContractors({ tab, q, companyId, categoryId, page }),
  ]);

  const filters = { q, companyId, categoryId };
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Contractors</h1>
        {canManage ? (
          <Link
            href="/contractors/new"
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue"
          >
            New company
          </Link>
        ) : null}
      </div>

      <nav aria-label="Contractor views" className="mt-6 flex flex-wrap gap-x-1 border-b border-line">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Link
              key={item.id}
              href={contractorHref({ tab: item.id, ...filters })}
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

      <form
        method="get"
        action="/contractors"
        className="filter-card mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
      >
        <input type="hidden" name="tab" value={tab} />
        <TextField
          label="Search contractors"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Company, contact, or email"
        />
        <SelectField label="Company" name="company" defaultValue={companyId}>
          <option value="">All companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Category" name="category" defaultValue={categoryId}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <button
          type="submit"
          className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue"
        >
          Apply
        </button>
      </form>
      {q || companyId || categoryId ? (
        <Link
          href={contractorHref({ tab })}
          className="mt-3 inline-block text-sm text-brand-blue hover:underline"
        >
          Clear filters
        </Link>
      ) : null}

      <p className="mt-4 text-sm text-muted">{countLabel(result.total, result.kind)}</p>

      {result.rows.length === 0 ? (
        <EmptyState>{emptyMessage(tab)}</EmptyState>
      ) : result.kind === "contacts" ? (
        <ContactResults rows={result.rows} />
      ) : (
        <CompanyResults rows={result.rows} canManage={canManage} showApproval={tab === "pending"} />
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={contractorHref({ tab, ...filters, page: page - 1 })} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {page < totalPages ? (
              <Link href={contractorHref({ tab, ...filters, page: page + 1 })} className="text-brand-blue hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-muted">Next</span>
            )}
          </div>
        </div>
      ) : null}

      <ContractorCategories categories={categories} canManage={canManage} />
    </section>
  );
}

function ContactResults({ rows }: { rows: ContactRow[] }) {
  return (
    <>
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <p className="font-medium">{row.name}</p>
            <p className="mt-1 text-sm">
              <CompanyLink id={row.companyId} name={row.companyName} />
            </p>
            <p className="mt-1 text-sm text-muted">{shownPhone(row.phone, row.mobile)}</p>
            <p className="text-sm break-all">{blank(row.email)}</p>
            <p className="mt-1 text-sm text-muted">{row.categoryName}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden table-card overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <CompanyLink id={row.companyId} name={row.companyName} />
                </td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{shownPhone(row.phone, row.mobile)}</td>
                <td className="px-4 py-3 break-all">{blank(row.email)}</td>
                <td className="px-4 py-3">{row.categoryName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompanyResults({
  rows,
  canManage,
  showApproval,
}: {
  rows: CompanyRow[];
  canManage: boolean;
  showApproval: boolean;
}) {
  return (
    <>
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <CompanyLink id={row.id} name={row.name} />
            <p className="mt-1 text-sm text-muted">{row.categoryName}</p>
            <p className="mt-1 text-sm">{blank(row.phone)}</p>
            <p className="text-sm break-all">{blank(row.email)}</p>
            <p className="mt-1 text-sm text-muted">{contactCount(row.contactCount)}</p>
            <p className="mt-2">
              <InsuranceBadge standing={row.insurance} />
            </p>
            {showApproval && canManage ? (
              <div className="mt-3">
                <ApproveButton companyId={row.id} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden table-card overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Contacts</th>
              <th className="px-4 py-3 font-medium">Insurance</th>
              {showApproval && canManage ? <th className="px-4 py-3 font-medium">Approval</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <CompanyLink id={row.id} name={row.name} />
                </td>
                <td className="px-4 py-3">{row.categoryName}</td>
                <td className="px-4 py-3">{blank(row.phone)}</td>
                <td className="px-4 py-3 break-all">{blank(row.email)}</td>
                <td className="px-4 py-3">{row.contactCount}</td>
                <td className="px-4 py-3">
                  <InsuranceBadge standing={row.insurance} />
                </td>
                {showApproval && canManage ? (
                  <td className="px-4 py-3">
                    <ApproveButton companyId={row.id} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ApproveButton({ companyId }: { companyId: string }) {
  return (
    <form action={approveCompany}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="returnTo" value="pending" />
      <button type="submit" className="rounded-md bg-brand-green px-3 py-1.5 text-sm font-medium text-brand-navy">
        Approve
      </button>
    </form>
  );
}

function CompanyLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/contractors/${id}`} className="font-medium text-brand-blue hover:underline">
      {name}
    </Link>
  );
}

function contractorHref(input: {
  tab: ContractorTab;
  q?: string;
  companyId?: string;
  categoryId?: string;
  page?: number;
}): string {
  const search = new URLSearchParams();
  search.set("tab", input.tab);
  if (input.q) search.set("q", input.q);
  if (input.companyId) search.set("company", input.companyId);
  if (input.categoryId) search.set("category", input.categoryId);
  if (input.page && input.page > 1) search.set("page", String(input.page));
  return `/contractors?${search.toString()}`;
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function blank(value: string | null): string {
  return value ? value : "—";
}

function shownPhone(phone: string | null, mobile: string | null): string {
  return phone || mobile || "—";
}

function contactCount(count: number): string {
  return count === 1 ? "1 contact" : `${count} contacts`;
}

function countLabel(total: number, kind: "contacts" | "companies"): string {
  if (kind === "contacts") return total === 1 ? "1 contact" : `${total} contacts`;
  return total === 1 ? "1 company" : `${total} companies`;
}

function emptyMessage(tab: ContractorTab): string {
  if (tab === "contacts") return "No contacts match.";
  if (tab === "expired") return "No companies have insurance that has expired.";
  if (tab === "pending") return "No companies are waiting for approval.";
  return "No companies match.";
}
