"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { saveTemplate, type TemplateFormState } from "@/app/actions/inspections";
import { SelectField, TextArea, TextField } from "@/components/field";
import { RetainedForm } from "@/components/retained-form";
import { formatInspectionType, INSPECTION_TYPES, type InspectionType } from "@/lib/inspections";

const primaryButton =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";
const quietButton = "rounded-md bg-white px-3 py-2 text-sm ring-1 ring-line hover:bg-page disabled:opacity-40";

type DraftItem = { key: string; name: string; guidance: string };
type DraftArea = { key: string; name: string; items: DraftItem[] };

export function InspectionTemplateForm({
  template,
}: {
  template?: {
    id: string;
    name: string;
    type: InspectionType;
    description: string;
    areas: { id: string; name: string; items: { id: string; name: string; guidance: string | null }[] }[];
  };
}) {
  const [state, action, pending] = useActionState(saveTemplate, {} as TemplateFormState);
  const [areas, setAreas] = useState<DraftArea[]>(() => initialAreas(template));
  const nextKey = useRef(1);

  function makeKey() {
    const key = `field-${nextKey.current}`;
    nextKey.current += 1;
    return key;
  }

  function updateArea(key: string, patch: Partial<DraftArea>) {
    setAreas((current) => current.map((area) => (area.key === key ? { ...area, ...patch } : area)));
  }

  function updateItem(areaKey: string, itemKey: string, patch: Partial<DraftItem>) {
    setAreas((current) =>
      current.map((area) =>
        area.key === areaKey
          ? { ...area, items: area.items.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)) }
          : area,
      ),
    );
  }

  return (
    <RetainedForm action={action} className="form-card mt-6 max-w-3xl space-y-6" values={state.values}>
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <TextField label="Name" name="name" defaultValue={template?.name ?? ""} error={state.errors?.name} required maxLength={160} />
      <SelectField label="Type" name="type" defaultValue={template?.type ?? "common_area"} error={state.errors?.type} required>
        {INSPECTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {formatInspectionType(type)}
          </option>
        ))}
      </SelectField>
      <TextArea
        label="Description"
        name="description"
        defaultValue={template?.description ?? ""}
        error={state.errors?.description}
        rows={3}
        maxLength={2000}
      />

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Areas</legend>
        {state.errors?.areas ? (
          <p role="alert" className="text-sm text-danger">
            {state.errors.areas}
          </p>
        ) : null}
        {areas.map((area, areaIndex) => (
          <div key={area.key} className="space-y-4 rounded-xl border border-line bg-card p-4">
            <input type="hidden" name="areaKey" value={area.key} />
            <TextField
              id={`area-${area.key}`}
              label="Area name"
              name="areaName"
              value={area.name}
              onChange={(event) => updateArea(area.key, { name: event.target.value })}
              maxLength={80}
              required
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={quietButton} disabled={areaIndex === 0} onClick={() => setAreas((current) => move(current, areaIndex, -1))}>
                Move area up
              </button>
              <button
                type="button"
                className={quietButton}
                disabled={areaIndex === areas.length - 1}
                onClick={() => setAreas((current) => move(current, areaIndex, 1))}
              >
                Move area down
              </button>
              <button
                type="button"
                className={quietButton}
                disabled={areas.length === 1}
                onClick={() => setAreas((current) => current.filter((entry) => entry.key !== area.key))}
              >
                Remove area
              </button>
            </div>
            <ul className="space-y-4">
              {area.items.map((item, itemIndex) => (
                <li key={item.key} className="space-y-3 rounded-lg bg-page p-3">
                  <input type="hidden" name="itemArea" value={area.key} />
                  <TextField
                    id={`item-${item.key}`}
                    label="Item"
                    name="itemName"
                    value={item.name}
                    onChange={(event) => updateItem(area.key, item.key, { name: event.target.value })}
                    maxLength={160}
                    required
                  />
                  <TextField
                    id={`guidance-${item.key}`}
                    label="Guidance note"
                    name="itemGuidance"
                    value={item.guidance}
                    onChange={(event) => updateItem(area.key, item.key, { guidance: event.target.value })}
                    maxLength={500}
                    placeholder="Optional"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={quietButton}
                      disabled={itemIndex === 0}
                      onClick={() =>
                        updateArea(area.key, { items: move(area.items, itemIndex, -1) })
                      }
                    >
                      Move item up
                    </button>
                    <button
                      type="button"
                      className={quietButton}
                      disabled={itemIndex === area.items.length - 1}
                      onClick={() => updateArea(area.key, { items: move(area.items, itemIndex, 1) })}
                    >
                      Move item down
                    </button>
                    <button
                      type="button"
                      className={quietButton}
                      disabled={area.items.length === 1}
                      onClick={() => updateArea(area.key, { items: area.items.filter((entry) => entry.key !== item.key) })}
                    >
                      Remove item
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={quietButton}
              onClick={() =>
                updateArea(area.key, { items: [...area.items, { key: makeKey(), name: "", guidance: "" }] })
              }
            >
              Add item
            </button>
          </div>
        ))}
        <button
          type="button"
          className={quietButton}
          onClick={() => setAreas((current) => [...current, { key: makeKey(), name: "", items: [{ key: makeKey(), name: "", guidance: "" }] }])}
        >
          Add area
        </button>
      </fieldset>

      <button type="submit" className={primaryButton} disabled={pending}>
        {pending ? "Saving…" : "Save template"}
      </button>
    </RetainedForm>
  );
}

function initialAreas(
  template: {
    areas: { id: string; name: string; items: { id: string; name: string; guidance: string | null }[] }[];
  } | undefined,
): DraftArea[] {
  if (!template || template.areas.length === 0) {
    return [{ key: "area-1", name: "", items: [{ key: "item-1", name: "", guidance: "" }] }];
  }
  return template.areas.map((area) => ({
    key: area.id,
    name: area.name,
    items: area.items.map((item) => ({ key: item.id, name: item.name, guidance: item.guidance ?? "" })),
  }));
}

function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const copy = list.slice();
  const current = copy[index];
  copy[index] = copy[target];
  copy[target] = current;
  return copy;
}
