"use client";

import { useActionState } from "react";
import {
  addBuildingNote,
  addUsefulNumber,
  updateBuildingNote,
  updateUsefulNumber,
  type NoteFormState,
  type NumberFormState,
} from "@/app/actions/dashboard";
import { TextArea, TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export function BuildingNoteForm({
  note,
}: {
  note?: { id: string; title: string | null; body: string };
}) {
  const action = note ? updateBuildingNote : addBuildingNote;
  const [state, formAction, pending] = useActionState(action, {} as NoteFormState);
  const titleId = note ? `note-title-${note.id}` : "note-title";
  const bodyId = note ? `note-body-${note.id}` : "note-body";
  return (
    <form action={formAction} className="mt-3 space-y-3">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextField id={titleId} label="Title" name="title" defaultValue={note?.title ?? ""} error={state.errors?.title} />
      <TextArea id={bodyId} label="Note" name="body" rows={3} required defaultValue={note?.body ?? ""} error={state.errors?.body} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : note ? "Save note" : "Add note"}
      </button>
    </form>
  );
}

export function UsefulNumberForm({
  entry,
}: {
  entry?: { id: string; label: string; number: string; notes: string | null };
}) {
  const action = entry ? updateUsefulNumber : addUsefulNumber;
  const [state, formAction, pending] = useActionState(action, {} as NumberFormState);
  const suffix = entry ? `-${entry.id}` : "";
  return (
    <form action={formAction} className="mt-3 space-y-3">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextField id={`number-label${suffix}`} label="Label" name="label" required defaultValue={entry?.label ?? ""} error={state.errors?.label} />
      <TextField
        id={`number-value${suffix}`}
        label="Number"
        name="number"
        type="tel"
        required
        defaultValue={entry?.number ?? ""}
        placeholder="02 0000 0000"
        error={state.errors?.number}
      />
      <TextArea id={`number-notes${suffix}`} label="Notes" name="notes" rows={2} defaultValue={entry?.notes ?? ""} error={state.errors?.notes} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : entry ? "Save number" : "Add number"}
      </button>
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
