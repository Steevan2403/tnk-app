"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBuilding, type BuildingFormState } from "@/app/actions/buildings";
import { AU_STATES, type BuildingRecord } from "@/lib/buildings";
import { SelectField, TextField } from "@/components/field";

const initial: BuildingFormState = {};

const STATE_NAMES: Record<(typeof AU_STATES)[number], string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory",
};

export function BuildingForm({ building }: { building?: BuildingRecord }) {
  const [state, action, pending] = useActionState(saveBuilding, initial);

  return (
    <form action={action} className="mt-6 max-w-xl space-y-4">
      {building ? <input type="hidden" name="id" value={building.id} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <TextField label="Name" name="name" defaultValue={building?.name} error={state.errors?.name} required />
      <TextField
        label="Street address"
        name="address"
        defaultValue={building?.address}
        error={state.errors?.address}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Suburb"
          name="suburb"
          defaultValue={building?.suburb}
          error={state.errors?.suburb}
          required
        />
        <SelectField
          label="State"
          name="state"
          defaultValue={building?.state ?? "NSW"}
          error={state.errors?.state}
        >
          {AU_STATES.map((code) => (
            <option key={code} value={code}>
              {STATE_NAMES[code]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Postcode"
          name="postcode"
          inputMode="numeric"
          defaultValue={building?.postcode}
          error={state.errors?.postcode}
          required
        />
        <TextField
          label="Lot count"
          name="lotCount"
          type="number"
          min={0}
          step={1}
          defaultValue={building?.lotCount}
          error={state.errors?.lotCount}
          required
        />
      </div>
      <TextField
        label="Photo URL"
        name="photoUrl"
        type="url"
        defaultValue={building?.photoUrl ?? ""}
        error={state.errors?.photoUrl}
        placeholder="Optional"
      />
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-navy px-4 py-2 font-medium text-white hover:bg-brand-blue disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save building"}
        </button>
        <Link href="/buildings" className="rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white">
          Cancel
        </Link>
      </div>
    </form>
  );
}
