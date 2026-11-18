"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/field";
import { CASE_AREAS, formatArea, type CaseArea } from "@/lib/cases";

export type PickerAsset = { id: string; name: string; categoryId: string; categoryName: string };

export type PickerCompany = { id: string; name: string; contacts: { id: string; name: string }[] };

const selectClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40";

export function JobAreaPicker({
  assets,
  apartments,
  area: initialArea,
  assetIds: initialAssetIds,
  apartmentId,
  errors,
}: {
  assets: PickerAsset[];
  apartments: { id: string; number: string }[];
  area: CaseArea;
  assetIds: string[];
  apartmentId: string;
  errors?: { area?: string; assetIds?: string; apartmentId?: string };
}) {
  const [area, setArea] = useState<CaseArea>(initialArea);
  const [categoryId, setCategoryId] = useState("");
  const [assetIds, setAssetIds] = useState<string[]>(initialAssetIds);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const asset of assets) seen.set(asset.categoryId, asset.categoryName);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [assets]);

  const visibleAssets = assets.filter((asset) => !categoryId || asset.categoryId === categoryId);
  const hiddenSelected = assetIds.filter((id) => !visibleAssets.some((asset) => asset.id === id));

  function toggle(id: string) {
    setAssetIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
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
      {errors?.area ? <p className="text-sm text-danger">{errors.area}</p> : null}
      {area === "asset" ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="asset-category">
            Asset category
          </label>
          <select
            id="asset-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={selectClass}
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
                  onChange={() => toggle(asset.id)}
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
          {errors?.assetIds ? <p className="text-sm text-danger">{errors.assetIds}</p> : null}
        </div>
      ) : null}
      {area === "apartment" ? (
        <SelectField label="Apartment" name="apartmentId" defaultValue={apartmentId} error={errors?.apartmentId} required>
          <option value="">Choose an apartment</option>
          {apartments.map((apartment) => (
            <option key={apartment.id} value={apartment.id}>
              {apartment.number}
            </option>
          ))}
        </SelectField>
      ) : null}
    </fieldset>
  );
}

export function AssigneePicker({
  companies,
  companyIds: initialCompanyIds,
  contactIds: initialContactIds,
  errors,
}: {
  companies: PickerCompany[];
  companyIds: string[];
  contactIds: string[];
  errors?: { companyIds?: string; contactIds?: string };
}) {
  const [companyIds, setCompanyIds] = useState<string[]>(initialCompanyIds);
  const [contactIds, setContactIds] = useState<string[]>(initialContactIds);
  const contactOptions = companies
    .filter((company) => companyIds.includes(company.id))
    .flatMap((company) => company.contacts.map((contact) => ({ ...contact, companyName: company.name })));

  function toggleCompany(id: string) {
    const next = companyIds.includes(id) ? companyIds.filter((item) => item !== id) : [...companyIds, id];
    const allowed = new Set(
      companies.filter((company) => next.includes(company.id)).flatMap((company) => company.contacts.map((contact) => contact.id)),
    );
    setCompanyIds(next);
    setContactIds((current) => current.filter((contactId) => allowed.has(contactId)));
  }

  function toggleContact(id: string) {
    setContactIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
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
        {errors?.companyIds ? <p className="mt-1 text-sm text-danger">{errors.companyIds}</p> : null}
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
                  onChange={() => toggleContact(contact.id)}
                  className="size-4 accent-brand-navy"
                />
                {contact.name}
                <span className="text-muted">{contact.companyName}</span>
              </label>
            ))}
          </div>
        )}
        {errors?.contactIds ? <p className="mt-1 text-sm text-danger">{errors.contactIds}</p> : null}
      </div>
    </fieldset>
  );
}
