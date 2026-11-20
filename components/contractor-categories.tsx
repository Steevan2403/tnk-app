"use client";

import { useActionState } from "react";
import {
  addContractorCategory,
  deleteContractorCategory,
  renameContractorCategory,
  type CategoryFormState,
} from "@/app/actions/contractors";
import { TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export function ContractorCategories({
  categories,
  canManage,
}: {
  categories: { id: string; name: string }[];
  canManage: boolean;
}) {
  return (
    <section
      aria-labelledby="contractor-categories-heading"
      className="rounded-xl border border-line bg-card p-4"
    >
      <h2 id="contractor-categories-heading" className="text-lg font-medium text-brand-navy">
        Contractor categories
      </h2>
      {canManage ? (
        <div className="mt-4 space-y-4">
          <AddCategoryForm />
          {categories.length === 0 ? <p className="text-sm text-muted">No categories yet.</p> : null}
          <ul className="divide-y divide-line">
            {categories.map((category) => (
              <li key={`${category.id}-${category.name}`} className="py-3">
                <CategoryRow category={category} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {categories.length === 0 ? <li className="py-2 text-sm text-muted">No categories yet.</li> : null}
          {categories.map((category) => (
            <li key={category.id} className="py-2 text-sm">
              {category.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddCategoryForm() {
  const [state, action, pending] = useActionState(addContractorCategory, {} as CategoryFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      {state.error ? (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {state.error}
        </p>
      ) : null}
      <TextField
        id="new-contractor-category"
        label="New category"
        name="name"
        error={state.errors?.name}
        required
      />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}

function CategoryRow({ category }: { category: { id: string; name: string } }) {
  const [renameState, renameAction, renamePending] = useActionState(renameContractorCategory, {} as CategoryFormState);
  const [removeState, removeAction, removePending] = useActionState(deleteContractorCategory, {} as CategoryFormState);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={renameAction} className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="id" value={category.id} />
        <TextField
          label="Category name"
          name="name"
          id={`contractor-category-${category.id}`}
          defaultValue={category.name}
          error={renameState.errors?.name}
          required
        />
        <button type="submit" disabled={renamePending} className={buttonClass}>
          {renamePending ? "Saving…" : "Save"}
        </button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="id" value={category.id} />
        <button
          type="submit"
          disabled={removePending}
          aria-label={`Remove ${category.name}`}
          className="px-1 py-2 text-sm text-danger hover:underline disabled:opacity-60"
        >
          {removePending ? "Removing…" : "Remove"}
        </button>
      </form>
      {renameState.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {renameState.error}
        </p>
      ) : null}
      {removeState.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {removeState.error}
        </p>
      ) : null}
    </div>
  );
}
