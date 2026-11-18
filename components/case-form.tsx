"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveCase, type CaseFormState } from "@/app/actions/cases";
import { CheckField, SelectField, TextArea, TextField } from "@/components/field";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CASE_AREAS, CASE_PRIORITIES, CASE_STATUSES, formatArea, formatPriority, formatStatus, type CaseArea } from "@/lib/cases";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export type CaseAssetOption = { id: string; name: string; categoryId: string; categoryName: string };

export type CaseCompanyOption = { id: string; name: string; contacts: { id: string; name: string }[] };

export type CaseFormValues = {
  number: number;
  typeId: string;
  purchaseOrderNumber: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
  area: CaseArea;
  assetIds: string[];
  apartmentId: string;
  companyIds: string[];
  contactIds: string[];
  subject: string;
  descriptionHtml: string;
  internalNotes: string;
  includeInReport: boolean;
};

export function CaseForm({
  types,
  assets,
  apartments,
  companies,
  dates,
  caseRecord,
}: {
  types: { id: string; name: string }[];
  assets: CaseAssetOption[];
  apartments: { id: string; number: string }[];
  companies: CaseCompanyOption[];
  dates: { startDate: string; dueDate: string };
  caseRecord?: CaseFormValues;
}) {
  const [state, action, pending] = useActionState(saveCase, {} as CaseFormState);
  const [area, setArea] = useState<CaseArea>(caseRecord?.area ?? "none");
  const [categoryId, setCategoryId] = useState("");
  const [assetIds, setAssetIds] = useState<string[]>(caseRecord?.assetIds ?? []);
  const [companyIds, setCompanyIds] = useState<string[]>(caseRecord?.companyIds ?? []);
  const [contactIds, setContactIds] = useState<string[]>(caseRecord?.contactIds ?? []);
  const back = caseRecord ? `/cases/${caseRecord.number}` : "/cases";

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const asset of assets) seen.set(asset.categoryId, asset.categoryName);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [assets]);

  const visibleAssets = assets.filter((asset) => !categoryId || asset.categoryId === categoryId);
  const hiddenSelected = assetIds.filter((id) => !visibleAssets.some((asset) => asset.id === id));
  const contactOptions = companies
    .filter((company) => companyIds.includes(company.id))
    .flatMap((company) => company.contacts.map((contact) => ({ ...contact, companyName: company.name })));

  function toggle(list: string[], id: string, setList: (next: string[]) => void) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function toggleCompany(id: string) {
    const next = companyIds.includes(id) ? companyIds.filter((item) => item !== id) : [...companyIds, id];
    const allowed = new Set(
      companies.filter((company) => next.includes(company.id)).flatMap((company) => company.contacts.map((contact) => contact.id)),
    );
    setCompanyIds(next);
    setContactIds((current) => current.filter((contactId) => allowed.has(contactId)));
  }

  return (
    <form action={action} className="mt-6 max-w-3xl space-y-8">
      {caseRecord ? <input type="hidden" name="number" value={caseRecord.number} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Case information</legend>
        <SelectField label="Case type" name="typeId" defaultValue={caseRecord?.typeId ?? ""} error={state.errors?.typeId} required>
          <option value="">Choose a type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Purchase order number"
          name="purchaseOrderNumber"
          defaultValue={caseRecord?.purchaseOrderNumber ?? ""}
          error={state.errors?.purchaseOrderNumber}
          placeholder="Optional"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            defaultValue={caseRecord?.startDate ?? dates.startDate}
            error={state.errors?.startDate}
            required
          />
          <TextField
            label="Due date"
            name="dueDate"
            type="date"
            defaultValue={caseRecord?.dueDate ?? dates.dueDate}
            error={state.errors?.dueDate}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Priority" name="priority" defaultValue={caseRecord?.priority ?? "low"} error={state.errors?.priority} required>
            {CASE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {formatPriority(priority)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" name="status" defaultValue={caseRecord?.status ?? "new"} error={state.errors?.status} required>
            {CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Job area</legend>
        <div className="flex flex-wrap gap-4">
          {CASE_AREAS.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="area"
                value={value}
                checked={area === value}
                onChange={() => setArea(value)}
                className="accent-brand-navy"
              />
              {formatArea(value)}
            </label>
          ))}
        </div>
        {state.errors?.area ? <p className="text-sm text-danger">{state.errors.area}</p> : null}
        {area === "asset" ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="asset-category">
              Asset category
            </label>
            <select
              id="asset-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-line p-3">
              {visibleAssets.length === 0 ? <p className="text-sm text-muted">No assets in this category.</p> : null}
              {visibleAssets.map((asset) => (
                <label key={asset.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="assetId"
                    value={asset.id}
                    checked={assetIds.includes(asset.id)}
                    onChange={() => toggle(assetIds, asset.id, setAssetIds)}
                    className="size-4 accent-brand-navy"
                  />
                  {asset.name}
                  <span className="text-muted">{asset.categoryName}</span>
                </label>
              ))}
            </div>
            {hiddenSelected.map((id) => (
              <input key={id} type="hidden" name="assetId" value={id} />
            ))}
            {state.errors?.assetIds ? <p className="text-sm text-danger">{state.errors.assetIds}</p> : null}
          </div>
        ) : null}
        {area === "apartment" ? (
          <SelectField
            label="Apartment"
            name="apartmentId"
            defaultValue={caseRecord?.apartmentId ?? ""}
            error={state.errors?.apartmentId}
            required
          >
            <option value="">Choose an apartment</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {apartment.number}
              </option>
            ))}
          </SelectField>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Assigned to</legend>
        <div>
          <p className="mb-2 text-sm font-medium">Contractor companies</p>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-line p-3">
            {companies.length === 0 ? <p className="text-sm text-muted">No approved contractors.</p> : null}
            {companies.map((company) => (
              <label key={company.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="companyId"
                  value={company.id}
                  checked={companyIds.includes(company.id)}
                  onChange={() => toggleCompany(company.id)}
                  className="size-4 accent-brand-navy"
                />
                {company.name}
              </label>
            ))}
          </div>
          {state.errors?.companyIds ? <p className="mt-1 text-sm text-danger">{state.errors.companyIds}</p> : null}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Contacts</p>
          {companyIds.length === 0 ? (
            <p className="text-sm text-muted">Choose a contractor to see its contacts.</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-line p-3">
              {contactOptions.length === 0 ? <p className="text-sm text-muted">Those contractors have no contacts.</p> : null}
              {contactOptions.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="contactId"
                    value={contact.id}
                    checked={contactIds.includes(contact.id)}
                    onChange={() => toggle(contactIds, contact.id, setContactIds)}
                    className="size-4 accent-brand-navy"
                  />
                  {contact.name}
                  <span className="text-muted">{contact.companyName}</span>
                </label>
              ))}
            </div>
          )}
          {state.errors?.contactIds ? <p className="mt-1 text-sm text-danger">{state.errors.contactIds}</p> : null}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Job</legend>
        <TextField label="Subject" name="subject" defaultValue={caseRecord?.subject ?? ""} error={state.errors?.subject} required />
        <RichTextEditor name="description" defaultValue={caseRecord?.descriptionHtml ?? ""} error={state.errors?.description} />
        <TextArea
          label="Internal notes"
          name="internalNotes"
          rows={4}
          defaultValue={caseRecord?.internalNotes ?? ""}
          error={state.errors?.internalNotes}
          placeholder="Optional"
        />
      </fieldset>

      <CheckField label="Include in management report" name="includeInReport" defaultChecked={caseRecord?.includeInReport ?? true} />

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save case"}
        </button>
        <Link href={back} className="text-sm text-brand-blue hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
