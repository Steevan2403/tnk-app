import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { deleteAsset, deleteAssetDocument, deleteAssetPhoto, deleteWarranty } from "@/app/actions/assets";
import { AssetDocumentForm, AssetPhotoForm, WarrantyForm } from "@/components/asset-record-forms";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PriorityBadge } from "@/components/priority-badge";
import { EmptyState, Panel } from "@/components/ui";
import { assetQrDataUrl } from "@/lib/asset-qr";
import {
  formatCalendarDate,
  formatIsoDate,
  formatMoney,
  isWarrantyExpired,
  MAX_ASSET_PHOTOS,
} from "@/lib/assets";
import { formatStatus } from "@/lib/cases";
import { getAsset, requireUser, type AssetDetail } from "@/lib/data";
import { canManageAssets } from "@/lib/roles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  if (!user.selectedBuildingId) return { title: "Asset" };
  const asset = await getAsset(user.selectedBuildingId, id);
  return { title: asset?.name ?? "Asset" };
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  if (!user.selectedBuildingId) notFound();

  const asset = await getAsset(user.selectedBuildingId, id);
  if (!asset) notFound();

  const canManage = canManageAssets(user.role);
  const warrantyId = first(query.warranty);
  const editing = asset.warranties.find((warranty) => warranty.id === warrantyId) ?? null;
  const qr = await assetQrDataUrl(asset.id);

  return (
    <section>
      <Link href="/building/assets" className="text-sm text-brand-blue hover:underline">
        All assets
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{asset.name}</h1>
          <p className="mt-2 text-muted">{asset.category.name}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/building/assets/${asset.id}/edit`} className="text-sm text-brand-blue hover:underline">
              Edit
            </Link>
            <form action={deleteAsset}>
              <input type="hidden" name="assetId" value={asset.id} />
              <ConfirmSubmit
                label="Delete asset"
                message="Delete this asset, including its photos, documents, and warranties?"
                className="text-sm text-danger hover:underline"
              />
            </form>
          </div>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
        <Field label="Location" value={blank(asset.location)} />
        <Field label="Make" value={blank(asset.make)} />
        <Field label="Model" value={blank(asset.model)} />
        <Field label="Serial number" value={blank(asset.serialNumber)} />
        <Field label="Barcode" value={blank(asset.barcode)} />
        <Field label="Date of purchase" value={formatCalendarDate(asset.purchasedOn)} />
        <Field label="Asset value" value={formatMoney(asset.assetValue?.toFixed(2) ?? null)} />
        <Field label="End-of-life value" value={formatMoney(asset.endOfLifeValue?.toFixed(2) ?? null)} />
        <Field label="Estimated life" value={asset.lifeMonths == null ? "—" : `${asset.lifeMonths} months`} />
        <Field label="Service company">
          {asset.company ? (
            <Link href={`/contractors/${asset.company.id}`} className="text-brand-blue hover:underline">
              {asset.company.name}
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Contact" value={blank(asset.contact?.name ?? null)} />
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted">Description</dt>
          <dd className="mt-1 whitespace-pre-wrap">{blank(asset.description)}</dd>
        </div>
      </dl>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Photos">
          <p className="mt-1 text-sm text-muted">
            {asset.photos.length} of {MAX_ASSET_PHOTOS}
          </p>
          {asset.photos.length === 0 ? <Empty>No photos yet.</Empty> : null}
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {asset.photos.map((photo) => (
              <li key={photo.id}>
                <a href={`/api/asset-files/photos/${photo.id}`}>
                  <GalleryImage name={photo.name} src={`/api/asset-files/photos/${photo.id}`} />
                </a>
                <p className="mt-2 truncate text-sm">{photo.name}</p>
                {canManage ? (
                  <form action={deleteAssetPhoto}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button type="submit" aria-label={`Remove ${photo.name}`} className="text-sm text-danger hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage ? <AssetPhotoForm assetId={asset.id} remaining={MAX_ASSET_PHOTOS - asset.photos.length} /> : null}
        </Panel>

        <Panel title="Documents">
          {asset.documents.length === 0 ? <Empty>No documents yet.</Empty> : null}
          <ul className="mt-2 divide-y divide-line">
            {asset.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{document.name}</p>
                  <p className="text-sm text-muted">{formatCalendarDate(document.uploadedAt)}</p>
                </div>
                <div className="flex gap-3">
                  <a href={`/api/asset-files/documents/${document.id}`} className="text-sm text-brand-blue hover:underline">
                    Download
                  </a>
                  {canManage ? (
                    <form action={deleteAssetDocument}>
                      <input type="hidden" name="assetId" value={asset.id} />
                      <input type="hidden" name="documentId" value={document.id} />
                      <button type="submit" aria-label={`Remove ${document.name}`} className="text-sm text-danger hover:underline">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {canManage ? <AssetDocumentForm assetId={asset.id} /> : null}
        </Panel>

        <Panel title="Warranties">
          {asset.warranties.length === 0 ? <Empty>No warranties yet.</Empty> : null}
          <ul className="mt-2 divide-y divide-line">
            {asset.warranties.map((warranty) => (
              <WarrantyRow key={warranty.id} assetId={asset.id} warranty={warranty} canManage={canManage} />
            ))}
          </ul>
          {canManage ? (
            <WarrantyForm
              assetId={asset.id}
              warranty={
                editing
                  ? {
                      id: editing.id,
                      provider: editing.provider,
                      startsOn: formatIsoDate(editing.startsOn),
                      expiresOn: formatIsoDate(editing.expiresOn),
                      notes: editing.notes,
                    }
                  : undefined
              }
            />
          ) : null}
        </Panel>

        <div className="space-y-6">
          <Panel title="QR code">
            {/* The QR is a generated data URL, which the image optimizer does not need to fetch. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt={`QR code for ${asset.name}`}
              width={180}
              height={180}
              className="mt-4 h-44 w-44"
            />
            <Link href={`/building/assets/${asset.id}/label`} className="mt-4 inline-block text-sm text-brand-blue hover:underline">
              Print label
            </Link>
          </Panel>
          <Panel title="Linked cases">
            {asset.caseLinks.length === 0 ? (
              <Empty>No cases yet.</Empty>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {[...asset.caseLinks]
                  .sort((a, b) => b.case.number - a.case.number)
                  .map((link) => (
                    <li key={link.case.number} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <Link href={`/cases/${link.case.number}`} className="font-medium text-brand-blue hover:underline">
                        #{link.case.number} {link.case.subject}
                      </Link>
                      <span className="flex items-center gap-2">
                        <PriorityBadge priority={link.case.priority} />
                        <span className="text-sm">{formatStatus(link.case.status)}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}

function WarrantyRow({
  assetId,
  warranty,
  canManage,
}: {
  assetId: string;
  warranty: AssetDetail["warranties"][number];
  canManage: boolean;
}) {
  const expired = isWarrantyExpired(warranty.expiresOn);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{warranty.provider}</p>
        <p className={`mt-1 text-sm ${expired ? "font-medium text-danger" : ""}`}>
          <time dateTime={formatIsoDate(warranty.startsOn)}>{formatCalendarDate(warranty.startsOn)}</time>
          {" – "}
          <time dateTime={formatIsoDate(warranty.expiresOn)} className={expired ? "text-danger" : undefined}>
            {formatCalendarDate(warranty.expiresOn)}
          </time>
        </p>
        {warranty.notes ? <p className="mt-1 text-sm whitespace-pre-wrap">{warranty.notes}</p> : null}
      </div>
      {canManage ? (
        <div className="flex gap-3">
          <Link href={`/building/assets/${assetId}?warranty=${warranty.id}`} className="text-sm text-brand-blue hover:underline">
            Edit
          </Link>
          <form action={deleteWarranty}>
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="warrantyId" value={warranty.id} />
            <button type="submit" aria-label={`Remove ${warranty.provider}`} className="text-sm text-danger hover:underline">
              Remove
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">{children ?? value}</dd>
    </div>
  );
}

function GalleryImage({ name, src }: { name: string; src: string }) {
  return (
    // The file route checks the signed-in user, which the image optimizer does not.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="aspect-square w-full rounded-md object-cover" />
  );
}

function Empty({ children }: { children: string }) {
  return <EmptyState>{children}</EmptyState>;
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function blank(value: string | null): string {
  return value && value.trim() ? value : "—";
}
