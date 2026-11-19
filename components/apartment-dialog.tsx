"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { saveApartment, type ApartmentFormState } from "@/app/actions/residents";
import { TextField } from "@/components/field";
import { apartmentClientErrors, type ApartmentField } from "@/lib/residents";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export function ApartmentDialog({
  apartment,
}: {
  apartment?: { id: string; number: string; lotNumber: string | null };
}) {
  const [state, action, pending] = useActionState(saveApartment, {} as ApartmentFormState);
  const [open, setOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<Partial<Record<ApartmentField, string>>>({});

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const errors = apartmentClientErrors(String(data.get("number") ?? ""), String(data.get("lotNumber") ?? ""));
    if (errors) {
      event.preventDefault();
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setClientErrors({});
          setOpen(true);
        }}
        className={
          apartment
            ? "rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white"
            : buttonClass
        }
      >
        {apartment ? "Edit" : "New apartment"}
      </button>
      <div className={open ? "fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/50 p-4 sm:items-center" : "hidden"}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={apartment ? "edit-apartment-title" : "new-apartment-title"}
          className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl"
        >
          <form action={action} className="space-y-4" onSubmit={onSubmit}>
            <h2 id={apartment ? "edit-apartment-title" : "new-apartment-title"} className="font-serif text-2xl">
              {apartment ? "Edit apartment" : "New apartment"}
            </h2>
            {apartment ? <input type="hidden" name="id" value={apartment.id} /> : null}
            {state.error ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            ) : null}
            <TextField
              label="Apartment number"
              name="number"
              defaultValue={apartment?.number}
              error={clientErrors.number ?? state.errors?.number}
              required
            />
            <TextField
              label="Lot number"
              name="lotNumber"
              defaultValue={apartment?.lotNumber ?? ""}
              error={clientErrors.lotNumber ?? state.errors?.lotNumber}
            />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending} className={buttonClass}>
                {pending ? "Saving…" : "Save apartment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientErrors({});
                  setOpen(false);
                }}
                className="rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
