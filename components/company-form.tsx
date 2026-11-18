"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCompany, type CompanyFormState } from "@/app/actions/contractors";
import { SelectField, TextField } from "@/components/field";
import { formatAbn } from "@/lib/contractors";

const initial: CompanyFormState = {};

export type CompanyFormValues = {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categoryId: string;
};

export function CompanyForm({
  company,
  categories,
}: {
  company?: CompanyFormValues;
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveCompany, initial);

  return (
    <form action={action} className="mt-6 max-w-xl space-y-4">
      {company ? <input type="hidden" name="id" value={company.id} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <TextField
        label="Company name"
        name="name"
        defaultValue={company?.name}
        error={state.errors?.name}
        required
      />
      <TextField
        label="ABN"
        name="abn"
        inputMode="numeric"
        defaultValue={company?.abn ? formatAbn(company.abn) : ""}
        error={state.errors?.abn}
        placeholder="Optional"
      />
      <TextField
        label="Address"
        name="address"
        defaultValue={company?.address ?? ""}
        error={state.errors?.address}
        placeholder="Optional"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Phone"
          name="phone"
          defaultValue={company?.phone ?? ""}
          error={state.errors?.phone}
          placeholder="Optional"
        />
        <TextField
          label="Company email"
          name="email"
          type="email"
          defaultValue={company?.email ?? ""}
          error={state.errors?.email}
          placeholder="Optional"
        />
      </div>
      <TextField
        label="Website"
        name="website"
        type="url"
        defaultValue={company?.website ?? ""}
        error={state.errors?.website}
        placeholder="Optional"
      />
      <SelectField
        label="Category"
        name="categoryId"
        defaultValue={company?.categoryId ?? categories[0]?.id}
        error={state.errors?.categoryId}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-navy px-4 py-2 font-medium text-white hover:bg-brand-blue disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save company"}
        </button>
        <Link
          href={company ? `/contractors/${company.id}` : "/contractors"}
          className="rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
