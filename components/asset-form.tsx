"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { saveAsset, type AssetFormState } from "@/app/actions/assets";
import { SelectField, TextArea, TextField } from "@/components/field";
import { RetainedForm, useSubmittedValues } from "@/components/retained-form";
import { textValue } from "@/lib/form-values";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export type AssetFormValues = {
  id: string;
  name: string;
  categoryId: string;
  location: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  barcode: string | null;
  purchasedOn: string;
  assetValue: string;
  endOfLifeValue: string;
  lifeMonths: string;
  description: string | null;
  companyId: string;
  contactId: string;
};

export type ServiceCompanyOption = {
  id: string;
  name: string;
  contacts: { id: string; name: string; companyId: string }[];
};

export function AssetForm({
  categories,
  companies,
  asset,
  today,
}: {
  categories: { id: string; name: string }[];
  companies: ServiceCompanyOption[];
  asset?: AssetFormValues;
  today: string;
}) {
  const [state, action, pending] = useActionState(saveAsset, {} as AssetFormState);
  const back = asset ? `/building/assets/${asset.id}` : "/building/assets";

  return (
    <RetainedForm action={action} className="form-card mt-6 max-w-2xl space-y-4" values={state.values}>
      {asset ? <input type="hidden" name="assetId" value={asset.id} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <TextField label="Asset name" name="name" defaultValue={asset?.name} error={state.errors?.name} required />
      <SelectField
        label="Category"
        name="categoryId"
        defaultValue={asset?.categoryId ?? ""}
        error={state.errors?.categoryId}
        required
      >
        <option value="">Choose a category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Location"
        name="location"
        defaultValue={asset?.location ?? ""}
        error={state.errors?.location}
        placeholder="Optional"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Make" name="make" defaultValue={asset?.make ?? ""} error={state.errors?.make} placeholder="Optional" />
        <TextField
          label="Model"
          name="model"
          defaultValue={asset?.model ?? ""}
          error={state.errors?.model}
          placeholder="Optional"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Serial number"
          name="serialNumber"
          defaultValue={asset?.serialNumber ?? ""}
          error={state.errors?.serialNumber}
          placeholder="Optional"
        />
        <TextField
          label="Barcode"
          name="barcode"
          defaultValue={asset?.barcode ?? ""}
          error={state.errors?.barcode}
          placeholder="Optional"
        />
      </div>
      <TextField
        label="Date of purchase"
        name="purchasedOn"
        type="date"
        defaultValue={asset?.purchasedOn ?? today}
        error={state.errors?.purchasedOn}
        required
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Asset value"
          name="assetValue"
          inputMode="decimal"
          defaultValue={asset?.assetValue ?? ""}
          error={state.errors?.assetValue}
          placeholder="Optional"
        />
        <TextField
          label="End-of-life value"
          name="endOfLifeValue"
          inputMode="decimal"
          defaultValue={asset?.endOfLifeValue ?? ""}
          error={state.errors?.endOfLifeValue}
          placeholder="Optional"
        />
        <TextField
          label="Estimated life (months)"
          name="lifeMonths"
          inputMode="numeric"
          defaultValue={asset?.lifeMonths ?? ""}
          error={state.errors?.lifeMonths}
          placeholder="Optional"
        />
      </div>
      <TextArea
        label="Description"
        name="description"
        rows={4}
        defaultValue={asset?.description ?? ""}
        error={state.errors?.description}
        placeholder="Optional"
      />
      <ServiceFields
        companies={companies}
        companyId={asset?.companyId ?? ""}
        contactId={asset?.contactId ?? ""}
        companyError={state.errors?.companyId}
        contactError={state.errors?.contactId}
      />
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save asset"}
        </button>
        <Link href={back} className="text-sm text-brand-blue hover:underline">
          Cancel
        </Link>
      </div>
    </RetainedForm>
  );
}

function ServiceFields({
  companies,
  companyId,
  contactId,
  companyError,
  contactError,
}: {
  companies: ServiceCompanyOption[];
  companyId: string;
  contactId: string;
  companyError?: string;
  contactError?: string;
}) {
  const submitted = useSubmittedValues();
  const [company, setCompany] = useState(String(textValue(submitted, "companyId", companyId) ?? ""));
  const [contact, setContact] = useState(String(textValue(submitted, "contactId", contactId) ?? ""));
  const contacts = companies.find((item) => item.id === company)?.contacts ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Service company"
        name="companyId"
        value={company}
        error={companyError}
        onChange={(event) => {
          const next = event.target.value;
          setCompany(next);
          const stillThere = companies.some(
            (item) => item.id === next && item.contacts.some((person) => person.id === contact),
          );
          if (!stillThere) setContact("");
        }}
      >
        <option value="">None</option>
        {companies.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Contact"
        name="contactId"
        value={contact}
        error={contactError}
        onChange={(event) => setContact(event.target.value)}
      >
        <option value="">None</option>
        {contacts.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
