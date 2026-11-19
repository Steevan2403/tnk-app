import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { getBuilding, requireUser } from "@/lib/data";
import { isSearchable, PAGE_PER_GROUP } from "@/lib/search";
import { searchRecords } from "@/lib/search-data";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const raw = first(params.q);
  const building = user.selectedBuildingId ? await getBuilding(user.selectedBuildingId) : null;
  const results = await searchRecords({
    buildingId: user.selectedBuildingId,
    role: user.role,
    query: raw,
    perGroup: PAGE_PER_GROUP,
  });
  const searchable = isSearchable(results.query);

  return (
    <section>
      <h1 className="font-serif text-3xl">Search</h1>
      {searchable ? (
        <p className="mt-2 text-muted">
          Results for “{results.query}”
          {building ? ` in ${building.name}` : ""}.
        </p>
      ) : (
        <p className="mt-2 text-muted">Type at least 2 characters in the search box.</p>
      )}
      {searchable && !building ? (
        <p className="mt-2 text-sm text-muted">Select a building to search its records. Contractors are available for the whole account.</p>
      ) : null}

      {searchable && results.groups.length === 0 ? <EmptyState>No matches for “{results.query}”.</EmptyState> : null}

      {results.groups.map((group) => (
        <section key={group.kind} className="mt-8">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-brand-navy">{group.label}</h2>
            <p className="text-sm text-muted">{group.total}</p>
          </div>
          {group.total > group.hits.length ? (
            <p className="mt-1 text-sm text-muted">
              Showing {group.hits.length} of {group.total}.
            </p>
          ) : null}
          <ul className="mt-3 overflow-hidden rounded-xl border border-line bg-card">
            {group.hits.map((hit) => (
              <li key={hit.href} className="border-b border-line last:border-0">
                <Link href={hit.href} className="block px-4 py-3 hover:bg-[#f3f6fd]">
                  <span className="font-medium text-brand-blue">{hit.title}</span>
                  {hit.detail ? <span className="mt-0.5 block text-sm text-muted">{hit.detail}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
