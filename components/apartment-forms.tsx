"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addApartmentNote,
  saveAgent,
  saveOwner,
  saveVehicle,
  uploadApartmentDocument,
  uploadApartmentImages,
  type AgentFormState,
  type DocumentFormState,
  type ImageFormState,
  type NoteFormState,
  type OwnerFormState,
  type VehicleFormState,
} from "@/app/actions/residents";
import { CheckField, FileField, TextArea, TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";
const cancelClass =
  "rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white";
const fileAccept = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx";
const imageAccept = ".png,.jpg,.jpeg,.webp,.gif";

export function ApartmentNoteForm({ apartmentId, tab }: { apartmentId: string; tab: string }) {
  const [state, action, pending] = useActionState(addApartmentNote, {} as NoteFormState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="apartmentId" value={apartmentId} />
      <input type="hidden" name="tab" value={tab} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextArea id="apartment-note" label="Note" name="body" rows={4} error={state.errors?.body} required />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}

export function VehicleForm({
  apartmentId,
  vehicle,
}: {
  apartmentId: string;
  vehicle?: {
    id: string;
    registration: string;
    make: string | null;
    model: string | null;
    colour: string | null;
    carSpace: string | null;
    location: string | null;
    photoName: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveVehicle, {} as VehicleFormState);
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="apartmentId" value={apartmentId} />
      {vehicle ? <input type="hidden" name="vehicleId" value={vehicle.id} /> : null}
      {state.error ? (
        <div className="sm:col-span-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      <TextField
        id="vehicle-registration"
        label="Registration"
        name="registration"
        defaultValue={vehicle?.registration}
        error={state.errors?.registration}
        required
      />
      <TextField id="vehicle-make" label="Make" name="make" defaultValue={vehicle?.make ?? ""} error={state.errors?.make} />
      <TextField id="vehicle-model" label="Model" name="model" defaultValue={vehicle?.model ?? ""} error={state.errors?.model} />
      <TextField
        id="vehicle-colour"
        label="Colour"
        name="colour"
        defaultValue={vehicle?.colour ?? ""}
        error={state.errors?.colour}
      />
      <TextField
        id="vehicle-space"
        label="Car space"
        name="carSpace"
        defaultValue={vehicle?.carSpace ?? ""}
        error={state.errors?.carSpace}
      />
      <TextField
        id="vehicle-location"
        label="Location"
        name="location"
        defaultValue={vehicle?.location ?? ""}
        error={state.errors?.location}
      />
      <div className="sm:col-span-2">
        <FileField id="vehicle-photo" label="Photo" name="photo" accept={imageAccept} error={state.errors?.photo} />
        <p className="mt-1 text-sm text-muted">
          {vehicle?.photoName ? `Current photo: ${vehicle.photoName}. A new image replaces it.` : "Optional. PNG, JPEG, WebP, or GIF up to 10 MB."}
        </p>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : vehicle ? "Save vehicle" : "Add vehicle"}
        </button>
        {vehicle ? (
          <Link href={`/residents/apartments/${apartmentId}?tab=vehicles`} className={cancelClass}>
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function ApartmentDocumentForm({ apartmentId }: { apartmentId: string }) {
  const [state, action, pending] = useActionState(uploadApartmentDocument, {} as DocumentFormState);
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="apartmentId" value={apartmentId} />
      {state.error ? (
        <div className="sm:col-span-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      <TextField id="apartment-document-name" label="Document name" name="name" error={state.errors?.name} />
      <TextField
        id="apartment-document-expiry"
        label="Expiry date"
        name="expiresOn"
        type="date"
        error={state.errors?.expiresOn}
      />
      <div className="sm:col-span-2">
        <FileField
          id="apartment-document-file"
          label="File"
          name="file"
          accept={fileAccept}
          error={state.errors?.file}
          required
        />
      </div>
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Uploading…" : "Upload document"}
        </button>
      </div>
    </form>
  );
}

export function ApartmentImageForm({ apartmentId }: { apartmentId: string }) {
  const [state, action, pending] = useActionState(uploadApartmentImages, {} as ImageFormState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="apartmentId" value={apartmentId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <FileField
        id="apartment-images"
        label="Images"
        name="files"
        accept={imageAccept}
        multiple
        error={state.errors?.files}
      />
      <p className="text-sm text-muted">PNG, JPEG, WebP, or GIF. 10 MB each. Up to 10 at a time.</p>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Uploading…" : "Upload images"}
      </button>
    </form>
  );
}

export function OwnerForm({
  apartmentId,
  owner,
}: {
  apartmentId: string;
  owner?: {
    id: string;
    name: string;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    postalAddress: string | null;
    strataCommittee: boolean;
  };
}) {
  const [state, action, pending] = useActionState(saveOwner, {} as OwnerFormState);
  return (
    <form action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="apartmentId" value={apartmentId} />
      {owner ? <input type="hidden" name="ownerId" value={owner.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextField id="owner-name" label="Name" name="name" defaultValue={owner?.name} error={state.errors?.name} required />
      <TextField id="owner-phone" label="Phone" name="phone" defaultValue={owner?.phone ?? ""} error={state.errors?.phone} />
      <TextField id="owner-mobile" label="Mobile" name="mobile" defaultValue={owner?.mobile ?? ""} error={state.errors?.mobile} />
      <TextField
        id="owner-email"
        label="Email"
        name="email"
        type="email"
        defaultValue={owner?.email ?? ""}
        error={state.errors?.email}
      />
      <TextField
        id="owner-address"
        label="Postal address"
        name="postalAddress"
        defaultValue={owner?.postalAddress ?? ""}
        error={state.errors?.postalAddress}
      />
      <CheckField
        id="owner-strata"
        label="Strata committee member"
        name="strataCommittee"
        defaultChecked={owner?.strataCommittee ?? false}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : owner ? "Save owner" : "Add owner"}
        </button>
        {owner ? (
          <Link href={`/residents/apartments/${apartmentId}`} className={cancelClass}>
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function AgentForm({
  apartmentId,
  agent,
}: {
  apartmentId: string;
  agent?: {
    company: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveAgent, {} as AgentFormState);
  return (
    <form action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="apartmentId" value={apartmentId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextField
        id="agent-company"
        label="Company"
        name="company"
        defaultValue={agent?.company}
        error={state.errors?.company}
        required
      />
      <TextField
        id="agent-contact"
        label="Contact name"
        name="contactName"
        defaultValue={agent?.contactName ?? ""}
        error={state.errors?.contactName}
      />
      <TextField id="agent-phone" label="Phone" name="phone" defaultValue={agent?.phone ?? ""} error={state.errors?.phone} />
      <TextField
        id="agent-email"
        label="Email"
        name="email"
        type="email"
        defaultValue={agent?.email ?? ""}
        error={state.errors?.email}
      />
      <TextField
        id="agent-address"
        label="Address"
        name="address"
        defaultValue={agent?.address ?? ""}
        error={state.errors?.address}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : agent ? "Save managing agent" : "Add managing agent"}
        </button>
        {agent ? (
          <Link href={`/residents/apartments/${apartmentId}`} className={cancelClass}>
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
