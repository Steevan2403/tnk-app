import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { SelectField, TextField } from "@/components/field";
import {
  formatCalendarDate,
  formatIsoDate,
  formatMoney,
  isWarrantyExpired,
  PAGE_SIZE,
  parsePage,
} from "@/lib/assets";
import { listAssetCategories, listAssets, requireUser, type AssetRow } from "@/lib/data";
import { canManageAssets } from "@/lib/roles";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = first(params.q).slice(0, 120);
  const categoryId = first(params.category);
  const warranty = first(params.warranty) === "expired" ? "expired" : "";
  const page = parsePage(first(params.page));
  const canManage = canManageAssets(user.role);
  const buildingId = user.selectedBuildingId;

  if (!buildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Assets</h1>
        <p className="mt-4 text-muted">Select a building to see its assets.</p>
      </section>
    );
  }

  const categories = await listAssetCategories();
  const selectedCategory = categories.some((category) => category.id === categoryId) ? categoryId : "";
  const result = await listAssets({ buildingId, q, categoryId: selectedCategory, warranty, page });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const filters = { q, categoryId: selectedCategory, warranty };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Assets</h1>
        {canManage ? (
          <Link
            href="/building/assets/new"
            className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue"
          >
            New asset
          </Link>
        ) : null}
      </div>

      <form method="get" action="/building/assets" className="filter-card mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <TextField
          label="Search assets"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name, serial, make, model, location, or barcode"
        />
        <SelectField label="Category" name="category" defaultValue={selectedCategory}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Warranty" name="warranty" defaultValue={warranty}>
          <option value="">All</option>
          <option value="expired">Expired</option>
        </SelectField>
        <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
          Apply
        </button>
      </form>
      {q || selectedCategory || warranty ? (
        <Link href="/building/assets" className="mt-3 inline-block text-sm text-brand-blue hover:underline">
          Clear filters
        </Link>
      ) : null}

      <p className="mt-4 text-sm text-muted">{result.total === 1 ? "1 asset" : `${result.total} assets`}</p>
      {result.rows.length === 0 ? (
        <EmptyState>{q || selectedCategory || warranty ? "No assets match." : "No assets yet."}</EmptyState>
      ) : (
        <AssetResults rows={result.rows} />
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={assetsHref({ ...filters, page: page - 1 })} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {page < totalPages ? (
              <Link href={assetsHref({ ...filters, page: page + 1 })} className="text-brand-blue hover:underline">
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

function AssetResults({ rows }: { rows: AssetRow[] }) {
  return (
    <>
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-card p-4">
            <p className="font-medium">
              <AssetLink row={row} />
            </p>
            <p className="mt-1 text-sm text-muted">
              {row.categoryName}
              {row.location ? ` · ${row.location}` : ""}
            </p>
            <p className="mt-2 text-sm">Serial {blank(row.serialNumber)}</p>
            <p className="text-sm">
              {blank(row.make)} {row.model ?? ""}
            </p>
            <p className="mt-2 text-sm">{formatMoney(row.assetValue)}</p>
            <p className="text-sm">{blank(row.companyName)}</p>
            <p className="mt-2 text-sm">
              Warranty <WarrantyDate date={row.warrantyExpiresOn} />
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden table-card overflow-x-auto rounded-xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Asset name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Serial</th>
              <th className="px-4 py-3 font-medium">Make</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Asset value</th>
              <th className="px-4 py-3 font-medium">Service company</th>
              <th className="px-4 py-3 font-medium">Purchase date</th>
              <th className="px-4 py-3 font-medium">Warranty expiry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <AssetLink row={row} />
                </td>
                <td className="px-4 py-3">{row.categoryName}</td>
                <td className="px-4 py-3">{blank(row.location)}</td>
                <td className="px-4 py-3">{blank(row.serialNumber)}</td>
                <td className="px-4 py-3">{blank(row.make)}</td>
                <td className="px-4 py-3">{blank(row.model)}</td>
                <td className="px-4 py-3">{formatMoney(row.assetValue)}</td>
                <td className="px-4 py-3">{blank(row.companyName)}</td>
                <td className="px-4 py-3">{formatCalendarDate(row.purchasedOn)}</td>
                <td className="px-4 py-3">
                  <WarrantyDate date={row.warrantyExpiresOn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AssetLink({ row }: { row: AssetRow }) {
  return (
    <Link href={`/building/assets/${row.id}`} className="font-medium text-brand-blue hover:underline">
      {row.name}
    </Link>
  );
}

function WarrantyDate({ date }: { date: Date | null }) {
  if (!date) return "—";
  const expired = isWarrantyExpired(date);
  return (
    <time dateTime={formatIsoDate(date)} className={expired ? "font-medium text-danger" : undefined}>
      {formatCalendarDate(date)}
    </time>
  );
}

function assetsHref(input: { q?: string; categoryId?: string; warranty?: string; page?: number }): string {
  const search = new URLSearchParams();
  if (input.q) search.set("q", input.q);
  if (input.categoryId) search.set("category", input.categoryId);
  if (input.warranty === "expired") search.set("warranty", "expired");
  if (input.page && input.page > 1) search.set("page", String(input.page));
  const query = search.toString();
  return query ? `/building/assets?${query}` : "/building/assets";
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function blank(value: string | null): string {
  return value ? value : "—";
}
