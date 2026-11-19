"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteMaintenanceFile, saveMaintenance, type MaintenanceFormState } from "@/app/actions/maintenance";
import { CheckField, FileField, SelectField, TextArea, TextField } from "@/components/field";
import { AssigneePicker, JobAreaPicker, type PickerAsset, type PickerCompany } from "@/components/job-pickers";
import { FREQUENCIES, formatFrequency, type Frequency } from "@/lib/maintenance";
import type { CaseArea } from "@/lib/cases";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export type MaintenanceFormValues = {
  id: string;
  subject: string;
  description: string;
  notes: string;
  startDate: string;
  endDate: string;
  noEnd: boolean;
  frequency: Frequency;
  intervalMonths: string;
  remindContractor: boolean;
  reminderDays: string;
  area: CaseArea;
  assetIds: string[];
  apartmentId: string;
  companyIds: string[];
  contactIds: string[];
  files: { id: string; name: string; kind: string }[];
};

export function MaintenanceForm({
  assets,
  apartments,
  companies,
  startDate,
  event,
}: {
  assets: PickerAsset[];
  apartments: { id: string; number: string }[];
  companies: PickerCompany[];
  startDate: string;
  event?: MaintenanceFormValues;
}) {
  const [state, action, pending] = useActionState(saveMaintenance, {} as MaintenanceFormState);
  const [noEnd, setNoEnd] = useState(event?.noEnd ?? true);
  const [frequency, setFrequency] = useState<string>(event?.frequency ?? "monthly");
  const [remind, setRemind] = useState(event?.remindContractor ?? false);

  return (
    <form action={action} className="form-card mt-6 max-w-3xl space-y-8">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Schedule</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            defaultValue={event?.startDate ?? startDate}
            error={state.errors?.startDate}
            required
          />
          <SelectField
            label="Frequency"
            name="frequency"
            value={frequency}
            onChange={(input) => setFrequency(input.target.value)}
            error={state.errors?.frequency}
            required
          >
            {FREQUENCIES.map((item) => (
              <option key={item} value={item}>
                {formatFrequency(item, null)}
              </option>
            ))}
          </SelectField>
        </div>
        <CheckField label="No end date" name="noEnd" checked={noEnd} onChange={(input) => setNoEnd(input.target.checked)} />
        {noEnd ? null : (
          <TextField
            label="End date"
            name="endDate"
            type="date"
            defaultValue={event?.endDate ?? ""}
            error={state.errors?.endDate}
            required
          />
        )}
        {frequency === "every_n_months" ? (
          <TextField
            label="Every how many months"
            name="intervalMonths"
            type="number"
            min={1}
            max={36}
            defaultValue={event?.intervalMonths ?? "2"}
            error={state.errors?.intervalMonths}
            required
          />
        ) : null}
        <CheckField
          label="Send an email reminder to the contractor"
          name="remindContractor"
          checked={remind}
          onChange={(input) => setRemind(input.target.checked)}
        />
        {remind ? (
          <TextField
            label="Days before each visit"
            name="reminderDays"
            type="number"
            min={0}
            max={90}
            defaultValue={event?.reminderDays ?? "7"}
            error={state.errors?.reminderDays}
            required
          />
        ) : null}
      </fieldset>

      <JobAreaPicker
        assets={assets}
        apartments={apartments}
        area={event?.area ?? "none"}
        assetIds={event?.assetIds ?? []}
        apartmentId={event?.apartmentId ?? ""}
        errors={state.errors}
      />
      <AssigneePicker
        companies={companies}
        companyIds={event?.companyIds ?? []}
        contactIds={event?.contactIds ?? []}
        errors={state.errors}
      />

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Job</legend>
        <TextField label="Subject" name="subject" defaultValue={event?.subject ?? ""} error={state.errors?.subject} required />
        <TextArea
          label="Description"
          name="description"
          rows={4}
          defaultValue={event?.description ?? ""}
          error={state.errors?.description}
          placeholder="Optional"
        />
        <TextArea label="Notes" name="notes" rows={3} defaultValue={event?.notes ?? ""} error={state.errors?.notes} placeholder="Optional" />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium text-brand-navy">Photos and documents</legend>
        <FileField label="Photos" name="photo" accept="image/png,image/jpeg,image/webp,image/gif" multiple />
        <FileField label="Documents" name="document" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx" multiple />
        {event && event.files.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {event.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-3">
                <a href={`/api/maintenance-files/${file.id}`} className="text-brand-blue hover:underline">
                  {file.name}
                </a>
                <button
                  type="submit"
                  form={`delete-file-${file.id}`}
                  className="text-danger hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save maintenance"}
        </button>
        <Link href="/maintenance" className="text-sm text-brand-blue hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function MaintenanceFileDeletes({ files }: { files: { id: string }[] }) {
  return (
    <>
      {files.map((file) => (
        <form key={file.id} id={`delete-file-${file.id}`} action={deleteMaintenanceFile}>
          <input type="hidden" name="id" value={file.id} />
        </form>
      ))}
    </>
  );
}
