"use client";

import { useActionState } from "react";
import { saveWorkOrderTerms, type WorkOrderTermsState } from "@/app/actions/work-order-terms";
import { TextArea, TextField } from "@/components/field";
import type { CompanySettingsInput } from "@/lib/work-order-terms";

const initial: WorkOrderTermsState = {};

export function WorkOrderTermsForm({ settings }: { settings: CompanySettingsInput }) {
  const [state, action, pending] = useActionState(saveWorkOrderTerms, initial);

  return (
    <form action={action} className="form-card mt-6 max-w-3xl space-y-4">
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-md bg-card px-3 py-2 text-sm">
          Saved.
        </p>
      ) : null}
      <TextField label="Company name" name="companyName" defaultValue={settings.companyName} maxLength={160} />
      <TextField
        label="Fallback site contact"
        name="siteContactName"
        defaultValue={settings.siteContactName}
        maxLength={120}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Fallback mobile" name="siteContactMobile" defaultValue={settings.siteContactMobile} maxLength={40} />
        <TextField
          label="Fallback email"
          name="siteContactEmail"
          type="email"
          defaultValue={settings.siteContactEmail}
          maxLength={200}
        />
      </div>
      <p className="text-sm text-muted">
        A building uses its own site contact when one is saved. These values are the fallback.
      </p>
      <TextArea
        label="Terms & Conditions"
        name="workOrderTerms"
        defaultValue={settings.workOrderTerms}
        rows={14}
        maxLength={12000}
      />
      <p className="text-sm text-muted">Numbering and line breaks are kept as typed. Leave this blank to omit the section.</p>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-navy px-4 py-2 font-medium text-white hover:bg-brand-blue disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <a href="/api/settings/work-order-preview" target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">
          Preview PDF
        </a>
      </div>
    </form>
  );
}
