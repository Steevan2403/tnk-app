import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { assetQrDataUrl } from "@/lib/asset-qr";
import { getAsset, requireUser } from "@/lib/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  if (!user.selectedBuildingId) return { title: "Asset label" };
  const asset = await getAsset(user.selectedBuildingId, id);
  return { title: asset ? `${asset.name} label` : "Asset label" };
}

export default async function AssetLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) notFound();

  const asset = await getAsset(user.selectedBuildingId, id);
  if (!asset) notFound();

  const qr = await assetQrDataUrl(asset.id);

  return (
    <section className="mx-auto max-w-sm">
      <Link href={`/building/assets/${asset.id}`} className="text-sm text-brand-blue hover:underline print:hidden">
        Back to asset
      </Link>
      <div className="mt-6 rounded-xl border border-line bg-card px-6 py-8 text-center print:mt-0 print:border-0">
        <p className="text-sm text-muted">{asset.building.name}</p>
        <h1 className="mt-2 font-serif text-3xl">{asset.name}</h1>
        {/* The QR is a generated data URL, which the image optimizer does not need to fetch. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code for ${asset.name}`}
          width={240}
          height={240}
          className="mx-auto mt-6 h-60 w-60"
        />
        <PrintButton />
      </div>
    </section>
  );
}
