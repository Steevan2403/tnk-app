"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  saveWarranty,
  uploadAssetDocument,
  uploadAssetPhotos,
  type DocumentFormState,
  type PhotoFormState,
  type WarrantyFormState,
} from "@/app/actions/assets";
import { FileField, TextArea, TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";
const fileAccept = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx";
const imageAccept = ".png,.jpg,.jpeg,.webp,.gif";

export function AssetPhotoForm({ assetId, remaining }: { assetId: string; remaining: number }) {
  const [state, action, pending] = useActionState(uploadAssetPhotos, {} as PhotoFormState);
  if (remaining < 1) return <p className="mt-4 text-sm text-muted">This asset already has 15 photos.</p>;

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="assetId" value={assetId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <FileField label="Photos" name="photos" accept={imageAccept} multiple error={state.errors?.photos} />
      <p className="text-sm text-muted">PNG, JPEG, WebP, or GIF. 10 MB each. {remaining} of 15 still available.</p>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Uploading…" : "Upload photos"}
      </button>
    </form>
  );
}

export function AssetDocumentForm({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(uploadAssetDocument, {} as DocumentFormState);
  return (
    <form action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="assetId" value={assetId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextField label="Document name" name="name" error={state.errors?.name} />
      <FileField label="File" name="file" accept={fileAccept} error={state.errors?.file} required />
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Uploading…" : "Upload document"}
        </button>
      </div>
    </form>
  );
}

export function WarrantyForm({
  assetId,
  warranty,
}: {
  assetId: string;
  warranty?: {
    id: string;
    provider: string;
    startsOn: string;
    expiresOn: string;
    notes: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveWarranty, {} as WarrantyFormState);
  return (
    <form action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="assetId" value={assetId} />
      {warranty ? <input type="hidden" name="warrantyId" value={warranty.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextField
        label="Provider"
        name="provider"
        defaultValue={warranty?.provider}
        error={state.errors?.provider}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Start date"
          name="startsOn"
          type="date"
          defaultValue={warranty?.startsOn}
          error={state.errors?.startsOn}
          required
        />
        <TextField
          label="Expiry date"
          name="expiresOn"
          type="date"
          defaultValue={warranty?.expiresOn}
          error={state.errors?.expiresOn}
          required
        />
      </div>
      <TextArea label="Notes" name="notes" rows={3} defaultValue={warranty?.notes ?? ""} error={state.errors?.notes} />
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : warranty ? "Save warranty" : "Add warranty"}
        </button>
        {warranty ? (
          <Link href={`/building/assets/${assetId}`} className="text-sm text-brand-blue hover:underline">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
