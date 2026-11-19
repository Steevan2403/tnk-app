"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCase, type CaseFormState } from "@/app/actions/cases";
import { CheckField, SelectField, TextArea, TextField } from "@/components/field";
import { RetainedForm } from "@/components/retained-form";
import { AssigneePicker, JobAreaPicker, type PickerAsset, type PickerCompany } from "@/components/job-pickers";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CASE_PRIORITIES, CASE_STATUSES, formatPriority, formatStatus, type CaseArea } from "@/lib/cases";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export type CaseAssetOption = PickerAsset;

export type CaseCompanyOption = PickerCompany;

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

export type CaseDraftValues = Omit<CaseFormValues, "number" | "priority" | "status" | "purchaseOrderNumber" | "includeInReport">;

export function CaseForm({
  types,
  assets,
  apartments,
  companies,
  dates,
  caseRecord,
  draft,
  source,
}: {
  types: { id: string; name: string }[];
  assets: CaseAssetOption[];
  apartments: { id: string; number: string }[];
  companies: CaseCompanyOption[];
  dates: { startDate: string; dueDate: string };
  caseRecord?: CaseFormValues;
  draft?: CaseDraftValues;
  source?: { eventId: string; occursOn: string };
}) {
  const [state, action, pending] = useActionState(saveCase, {} as CaseFormState);
  const values = caseRecord ?? draft;
  const back = caseRecord ? `/cases/${caseRecord.number}` : "/cases";

  return (
    <RetainedForm action={action} className="form-card mt-6 max-w-3xl space-y-8" values={state.values}>
      {caseRecord ? <input type="hidden" name="number" value={caseRecord.number} /> : null}
      {source ? (
        <>
          <input type="hidden" name="maintenanceEventId" value={source.eventId} />
          <input type="hidden" name="occurrenceOn" value={source.occursOn} />
        </>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-4">
        <TextField
          label="Subject"
          name="subject"
          defaultValue={values?.subject ?? ""}
          error={state.errors?.subject}
          required
          markRequired
        />
        <SelectField
          label="Case type"
          name="typeId"
          defaultValue={values?.typeId ?? ""}
          error={state.errors?.typeId}
          required
          markRequired
        >
          <option value="">Choose a type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectField>
        <RichTextEditor name="description" defaultValue={values?.descriptionHtml ?? ""} error={state.errors?.description} />
      </div>

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Case information</legend>
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
            defaultValue={values?.startDate ?? dates.startDate}
            error={state.errors?.startDate}
            required
            markRequired
          />
          <TextField
            label="Due date"
            name="dueDate"
            type="date"
            defaultValue={values?.dueDate ?? ""}
            error={state.errors?.dueDate}
            hint="Leave this blank and the due date is set to 7 days after the start date."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Priority"
            name="priority"
            defaultValue={caseRecord?.priority ?? ""}
            error={state.errors?.priority}
            required
            markRequired
          >
            <option value="">Choose a priority</option>
            {CASE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {formatPriority(priority)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            name="status"
            defaultValue={caseRecord?.status ?? "new"}
            error={state.errors?.status}
            required
            markRequired
          >
            {CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <JobAreaPicker
        assets={assets}
        apartments={apartments}
        area={values?.area ?? "none"}
        assetIds={values?.assetIds ?? []}
        apartmentId={values?.apartmentId ?? ""}
        errors={state.errors}
      />
      <AssigneePicker
        companies={companies}
        companyIds={values?.companyIds ?? []}
        contactIds={values?.contactIds ?? []}
        errors={state.errors}
      />

      <TextArea
        label="Internal notes"
        name="internalNotes"
        rows={4}
        defaultValue={values?.internalNotes ?? ""}
        error={state.errors?.internalNotes}
        placeholder="Optional"
      />

      <CheckField label="Include in management report" name="includeInReport" defaultChecked={caseRecord?.includeInReport ?? true} />

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save case"}
        </button>
        <Link href={back} className="text-sm text-brand-blue hover:underline">
          Cancel
        </Link>
      </div>
    </RetainedForm>
  );
}
