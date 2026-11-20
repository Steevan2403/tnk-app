"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveKey, type KeyFormState } from "@/app/actions/keys";
import { SelectField, TextArea, TextField } from "@/components/field";
import { RetainedForm } from "@/components/retained-form";
import { KEY_TYPES, formatKeyType, type KeyType } from "@/lib/keys";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";
const cancelClass =
  "rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white";

export function KeyDialog({
  apartmentId,
  keyRecord,
}: {
  apartmentId: string;
  keyRecord?: {
    id: string;
    number: string;
    type: KeyType;
    location: string | null;
    comment: string | null;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveKey, {} as KeyFormState);
  const title = keyRecord ? "Edit key" : "Add key";
  const titleId = keyRecord ? "edit-key-title" : "add-key-title";
  const fieldId = keyRecord ? `key-${keyRecord.id}` : "new-key";
  const closeHref = `/residents/apartments/${apartmentId}?tab=keys`;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(closeHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl"
      >
        <RetainedForm action={action} className="space-y-4" noValidate values={state.values}>
          <h2 id={titleId} className="font-serif text-2xl">
            {title}
          </h2>
          <input type="hidden" name="apartmentId" value={apartmentId} />
          {keyRecord ? <input type="hidden" name="keyId" value={keyRecord.id} /> : null}
          {state.error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          ) : null}
          <TextField
            id={`${fieldId}-number`}
            label="Key number"
            name="number"
            defaultValue={keyRecord?.number}
            error={state.errors?.number}
            required
            maxLength={40}
          />
          <SelectField
            id={`${fieldId}-type`}
            label="Type"
            name="type"
            defaultValue={keyRecord?.type ?? "door"}
            error={state.errors?.type}
            required
          >
            {KEY_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatKeyType(type)}
              </option>
            ))}
          </SelectField>
          <TextField
            id={`${fieldId}-location`}
            label="Location"
            name="location"
            defaultValue={keyRecord?.location ?? ""}
            error={state.errors?.location}
            maxLength={80}
          />
          <TextArea
            id={`${fieldId}-comment`}
            label="Comment"
            name="comment"
            rows={3}
            defaultValue={keyRecord?.comment ?? ""}
            error={state.errors?.comment}
            maxLength={500}
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? "Saving…" : keyRecord ? "Save key" : "Add key"}
            </button>
            <Link href={closeHref} className={cancelClass}>
              Cancel
            </Link>
          </div>
        </RetainedForm>
      </div>
    </div>
  );
}
