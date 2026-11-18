import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AssetForm } from "@/components/asset-form";
import { todayIso } from "@/lib/assets";
import { listAssetCategories, listServiceCompanies, requireUser } from "@/lib/data";
import { canManageAssets } from "@/lib/roles";

export const metadata: Metadata = { title: "New asset" };

export default async function NewAssetPage() {
  const user = await requireUser();
  if (!canManageAssets(user.role) || !user.selectedBuildingId) redirect("/building/assets");

  const [categories, companies] = await Promise.all([listAssetCategories(), listServiceCompanies()]);

  return (
    <section>
      <Link href="/building/assets" className="text-sm text-brand-blue hover:underline">
        All assets
      </Link>
      <h1 className="mt-3 font-serif text-3xl">New asset</h1>
      {categories.length === 0 ? (
        <p className="mt-6 text-muted">Add an asset category before adding an asset.</p>
      ) : (
        <AssetForm
          categories={categories}
          companies={companies}
          today={todayIso()}
        />
      )}
    </section>
  );
}
