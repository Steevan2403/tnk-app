import type { Metadata } from "next";
import Link from "next/link";
import { AssetCategories } from "@/components/asset-categories";
import { CaseTypes } from "@/components/case-types";
import { ContractorCategories } from "@/components/contractor-categories";
import { listAssetCategories, listCaseTypes, listContractorCategories, requireUser } from "@/lib/data";
import { canManageAssetCategories, canManageCaseTypes, canManageContractors } from "@/lib/roles";

export const metadata: Metadata = { title: "Categories" };

const TABS = [
  { id: "contractors", label: "Contractor categories" },
  { id: "assets", label: "Asset categories" },
  { id: "cases", label: "Case types" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const tab = parseTab(first((await searchParams).tab));

  return (
    <section>
      <h1 className="font-serif text-3xl">Categories</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Contractor categories, asset categories, and case types. Admins and managers can edit them. Staff can view them.
      </p>
      <nav aria-label="Category lists" className="mt-6 flex flex-wrap gap-x-1 border-b border-line">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Link
              key={item.id}
              href={`/building/categories?tab=${item.id}`}
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
      <div className="mt-6">
        {tab === "contractors" ? <ContractorTab canManage={canManageContractors(user.role)} /> : null}
        {tab === "assets" ? <AssetTab canManage={canManageAssetCategories(user.role)} /> : null}
        {tab === "cases" ? <CaseTab canManage={canManageCaseTypes(user.role)} /> : null}
      </div>
    </section>
  );
}

async function ContractorTab({ canManage }: { canManage: boolean }) {
  const categories = await listContractorCategories();
  return <ContractorCategories categories={categories} canManage={canManage} />;
}

async function AssetTab({ canManage }: { canManage: boolean }) {
  const categories = await listAssetCategories();
  return (
    <AssetCategories
      canManage={canManage}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        assetCount: category._count.assets,
      }))}
    />
  );
}

async function CaseTab({ canManage }: { canManage: boolean }) {
  const types = await listCaseTypes();
  return (
    <CaseTypes
      canManage={canManage}
      types={types.map((type) => ({ id: type.id, name: type.name, caseCount: type._count.cases }))}
    />
  );
}

function parseTab(value: string): TabId {
  if (value === "assets" || value === "cases" || value === "contractors") return value;
  return "contractors";
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
