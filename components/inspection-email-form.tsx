"use client";

import { useActionState } from "react";
import { emailInspectionReport, type ReportEmailState } from "@/app/actions/inspections";
import { TextField } from "@/components/field";

export function EmailReportForm({ runId, subject, body }: { runId: string; subject: string; body: string }) {
  const [state, action, pending] = useActionState(emailInspectionReport, {} as ReportEmailState);

  return (
    <form action={action} className="form-card mt-6 max-w-xl space-y-4">
      <input type="hidden" name="runId" value={runId} />
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <TextField label="To" name="to" type="email" required error={state.errors?.to} autoComplete="email" />
      <div>
        <p className="text-sm font-medium">Subject</p>
        <p className="mt-1">{subject}</p>
      </div>
      <div>
        <p className="text-sm font-medium">Message</p>
        <p className="mt-1 whitespace-pre-wrap">{body}</p>
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60">
        {pending ? "Queuing…" : "Email report"}
      </button>
    </form>
  );
}
