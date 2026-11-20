"use client";

import { useActionState } from "react";
import { addCaseType, deleteCaseType, renameCaseType, type CaseTypeFormState } from "@/app/actions/cases";
import { TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export function CaseTypes({
  types,
  canManage,
}: {
  types: { id: string; name: string; caseCount: number }[];
  canManage: boolean;
}) {
  return (
    <section aria-labelledby="case-types-heading" className="rounded-xl border border-line bg-card p-4">
      <h2 id="case-types-heading" className="text-lg font-medium text-brand-navy">
        Case types
      </h2>
      {canManage ? (
        <div className="mt-4 space-y-4">
          <AddTypeForm />
          {types.length === 0 ? <p className="text-sm text-muted">No case types yet.</p> : null}
          <ul className="divide-y divide-line">
            {types.map((type) => (
              <li key={`${type.id}-${type.name}`} className="py-3">
                <RenameTypeForm type={type} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {types.length === 0 ? <li className="py-2 text-sm text-muted">No case types yet.</li> : null}
          {types.map((type) => (
            <li key={type.id} className="py-2 text-sm">
              {type.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddTypeForm() {
  const [state, action, pending] = useActionState(addCaseType, {} as CaseTypeFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      {state.error ? (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {state.error}
        </p>
      ) : null}
      <TextField id="new-case-type" label="New case type" name="name" error={state.errors?.name} required />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add case type"}
      </button>
    </form>
  );
}

function RenameTypeForm({ type }: { type: { id: string; name: string; caseCount: number } }) {
  const [state, action, pending] = useActionState(renameCaseType, {} as CaseTypeFormState);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={action} className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="id" value={type.id} />
        <TextField
          label="Case type name"
          name="name"
          id={`case-type-${type.id}`}
          defaultValue={type.name}
          error={state.errors?.name}
          required
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {type.caseCount === 0 ? (
        <form action={deleteCaseType}>
          <input type="hidden" name="id" value={type.id} />
          <button type="submit" className="px-1 py-2 text-sm text-danger hover:underline">
            Remove
          </button>
        </form>
      ) : (
        <p className="px-1 py-2 text-sm text-muted">In use</p>
      )}
      {state.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
