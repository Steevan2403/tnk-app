import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssetForm, type AssetFormValues } from "@/components/asset-form";
import { formatIsoDate, moneyInputValue, todayIso } from "@/lib/assets";
import { getAsset, listAssetCategories, listServiceCompanies, requireUser } from "@/lib/data";
import { canManageAssets } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!canManageAssets(user.role) || !user.selectedBuildingId) redirect(`/building/assets/${id}`);

  const asset = await getAsset(user.selectedBuildingId, id);
  if (!asset) notFound();

  const [categories, companies] = await Promise.all([
    listAssetCategories(),
    listServiceCompanies(asset.companyId),
  ]);

  const values: AssetFormValues = {
    id: asset.id,
    name: asset.name,
    categoryId: asset.categoryId,
    location: asset.location,
    make: asset.make,
    model: asset.model,
    serialNumber: asset.serialNumber,
    barcode: asset.barcode,
    purchasedOn: formatIsoDate(asset.purchasedOn),
    assetValue: moneyInputValue(asset.assetValue),
    endOfLifeValue: moneyInputValue(asset.endOfLifeValue),
    lifeMonths: asset.lifeMonths == null ? "" : String(asset.lifeMonths),
    description: asset.description,
    companyId: asset.companyId ?? "",
    contactId: asset.contactId ?? "",
  };

  return (
    <section>
      <Link href={`/building/assets/${asset.id}`} className="text-sm text-brand-blue hover:underline">
        Back to asset
      </Link>
      <h1 className="mt-3 font-serif text-3xl">Edit {asset.name}</h1>
      <AssetForm categories={categories} companies={companies} asset={values} today={todayIso()} />
    </section>
  );
}
