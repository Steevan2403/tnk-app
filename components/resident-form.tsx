"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveResident, type ResidentFormState } from "@/app/actions/residents";
import { CheckField, SelectField, TextArea, TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export type ResidentFormValues = {
  id: string;
  apartmentId: string;
  firstName: string;
  lastName: string;
  type: string;
  phone: string | null;
  mobile: string | null;
  secondaryPhone: string | null;
  email: string | null;
  moveInOn: string;
  moveOutOn: string;
  primaryContact: boolean;
  notes: string | null;
};

export function ResidentForm({
  apartments,
  resident,
  apartmentId = "",
  returnTo = "",
}: {
  apartments: { id: string; number: string; lotNumber: string }[];
  resident?: ResidentFormValues;
  apartmentId?: string;
  returnTo?: string;
}) {
  const [state, action, pending] = useActionState(saveResident, {} as ResidentFormState);
  const back = resident ? `/residents/apartments/${resident.apartmentId}` : "/residents";

  return (
    <form action={action} className="mt-6 max-w-2xl space-y-4">
      {resident ? <input type="hidden" name="residentId" value={resident.id} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SelectField
        label="Apartment"
        name="apartmentId"
        defaultValue={resident?.apartmentId ?? apartmentId}
        error={state.errors?.apartmentId}
        required
      >
        <option value="">Choose an apartment</option>
        {apartments.map((apartment) => (
          <option key={apartment.id} value={apartment.id}>
            {apartment.number} · Lot {apartment.lotNumber}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          name="firstName"
          defaultValue={resident?.firstName}
          error={state.errors?.firstName}
          required
        />
        <TextField
          label="Last name"
          name="lastName"
          defaultValue={resident?.lastName}
          error={state.errors?.lastName}
          required
        />
      </div>
      <SelectField label="Resident type" name="type" defaultValue={resident?.type ?? ""} error={state.errors?.type} required>
        <option value="">Choose a type</option>
        <option value="owner">Owner</option>
        <option value="tenant">Tenant</option>
        <option value="other">Other</option>
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Phone" name="phone" defaultValue={resident?.phone ?? ""} error={state.errors?.phone} />
        <TextField label="Mobile" name="mobile" defaultValue={resident?.mobile ?? ""} error={state.errors?.mobile} />
        <TextField
          label="Secondary phone"
          name="secondaryPhone"
          defaultValue={resident?.secondaryPhone ?? ""}
          error={state.errors?.secondaryPhone}
        />
      </div>
      <TextField
        label="Email"
        name="email"
        type="email"
        defaultValue={resident?.email ?? ""}
        error={state.errors?.email}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Move-in date"
          name="moveInOn"
          type="date"
          defaultValue={resident?.moveInOn ?? ""}
          error={state.errors?.moveInOn}
        />
        <TextField
          label="Move-out date"
          name="moveOutOn"
          type="date"
          defaultValue={resident?.moveOutOn ?? ""}
          error={state.errors?.moveOutOn}
        />
      </div>
      <CheckField
        id="primary-contact"
        label="Primary contact"
        name="primaryContact"
        defaultChecked={resident?.primaryContact ?? false}
        error={state.errors?.primaryContact}
      />
      <TextArea label="Notes" name="notes" rows={4} defaultValue={resident?.notes ?? ""} error={state.errors?.notes} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save resident"}
        </button>
        <Link
          href={back}
          className="rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
