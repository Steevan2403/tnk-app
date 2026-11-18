"use client";

import { useActionState } from "react";
import { addAssetCategory, deleteAssetCategory, renameAssetCategory, type CategoryFormState } from "@/app/actions/assets";
import { TextField } from "@/components/field";

const buttonClass =
  "rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export function AssetCategories({
  categories,
}: {
  categories: { id: string; name: string; assetCount: number }[];
}) {
  return (
    <details className="mt-8 rounded-xl border border-line bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium text-brand-navy">Asset categories</summary>
      <div className="mt-4 space-y-4">
        <AddCategoryForm />
        <ul className="divide-y divide-line">
          {categories.map((category) => (
            <li key={category.id} className="py-3">
              <RenameCategoryForm category={category} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function AddCategoryForm() {
  const [state, action, pending] = useActionState(addAssetCategory, {} as CategoryFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      {state.error ? <p className="text-sm text-danger sm:col-span-2">{state.error}</p> : null}
      <TextField label="New category" name="name" error={state.errors?.name} required />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}

function RenameCategoryForm({ category }: { category: { id: string; name: string; assetCount: number } }) {
  const [state, action, pending] = useActionState(renameAssetCategory, {} as CategoryFormState);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={action} className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="id" value={category.id} />
        <TextField
          label="Category name"
          name="name"
          id={`category-${category.id}`}
          defaultValue={category.name}
          error={state.errors?.name}
          required
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {category.assetCount === 0 ? (
        <form action={deleteAssetCategory}>
          <input type="hidden" name="id" value={category.id} />
          <button type="submit" className="px-1 py-2 text-sm text-danger hover:underline">
            Remove
          </button>
        </form>
      ) : (
        <p className="px-1 py-2 text-sm text-muted">In use</p>
      )}
      {state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </div>
  );
}
