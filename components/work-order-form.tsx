"use client";

import { useActionState, useState } from "react";
import { sendWorkOrder, type WorkOrderFormState } from "@/app/actions/work-orders";
import { SelectField, TextArea, TextField } from "@/components/field";

export type WorkOrderContractorOption = {
  id: string;
  name: string;
  categoryName: string;
  pending: boolean;
  contacts: { id: string; name: string; email: string }[];
};

const buttonClass = "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

export function WorkOrderForm({
  caseNumber,
  contractors,
  defaultCompanyId,
  defaultContactId,
  defaultSubject,
  defaultMessage,
  defaultPurchaseOrder,
  files,
  attachmentBudget,
  budgetLabel,
}: {
  caseNumber: number;
  contractors: WorkOrderContractorOption[];
  defaultCompanyId: string;
  defaultContactId: string;
  defaultSubject: string;
  defaultMessage: string;
  defaultPurchaseOrder: string;
  files: { id: string; name: string; kind: string; size: number | null; sizeLabel: string }[];
  attachmentBudget: number;
  budgetLabel: string;
}) {
  const [state, action, pending] = useActionState(sendWorkOrder, {} as WorkOrderFormState);
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [contactId, setContactId] = useState(defaultContactId);
  const [picked, setPicked] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const selectedContractor = contractors.find((contractor) => contractor.id === companyId);
  const contacts = selectedContractor?.contacts ?? [];
  const selectedBytes = files.reduce((sum, file) => {
    if (!picked.includes(file.id) || file.size == null) return sum;
    return sum + file.size;
  }, 0);

  return (
    <form action={action} className="mt-6 max-w-3xl space-y-4">
      <input type="hidden" name="number" value={caseNumber} />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {previewError ? <p className="text-sm text-danger">{previewError}</p> : null}
      <div>
        <SelectField
          label="Contractor"
          name="companyId"
          value={companyId}
          error={state.errors?.companyId}
          required
          onChange={(event) => {
            const next = event.target.value;
            setCompanyId(next);
            const people = contractors.find((contractor) => contractor.id === next)?.contacts ?? [];
            setContactId(people[0]?.id ?? "");
          }}
        >
          <option value="">Choose a contractor</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.pending ? `${contractor.name} (pending)` : contractor.name}
            </option>
          ))}
        </SelectField>
        {selectedContractor ? (
          <p className="mt-1 text-sm text-muted">Category: {selectedContractor.categoryName}</p>
        ) : null}
      </div>
      <SelectField
        label="Contact"
        name="contactId"
        value={contactId}
        error={state.errors?.contactId}
        required
        onChange={(event) => setContactId(event.target.value)}
      >
        <option value="">{contacts.length ? "Choose a contact" : "No contact with an email"}</option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.name} · {contact.email}
          </option>
        ))}
      </SelectField>
      <TextField label="Subject" name="subject" defaultValue={defaultSubject} error={state.errors?.subject} maxLength={200} required />
      <TextArea label="Message" name="message" defaultValue={defaultMessage} error={state.errors?.message} rows={6} maxLength={8000} />
      <TextField label="Attending" name="attendingAt" type="datetime-local" error={state.errors?.attendingAt} />
      <TextField
        label="Purchase order"
        name="purchaseOrderNumber"
        defaultValue={defaultPurchaseOrder}
        error={state.errors?.purchaseOrderNumber}
        maxLength={80}
      />
      <TextArea label="Access notes" name="accessNotes" error={state.errors?.accessNotes} rows={3} maxLength={2000} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Attachments</legend>
        {files.length === 0 ? <p className="text-sm text-muted">This case has no photos or documents.</p> : null}
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="fileId"
                  value={file.id}
                  className="size-4 accent-brand-navy"
                  onChange={(event) => {
                    const id = file.id;
                    setPicked((current) =>
                      event.target.checked
                        ? current.includes(id)
                          ? current
                          : [...current, id]
                        : current.filter((item) => item !== id),
                    );
                  }}
                />
                {file.name}
                <span className="text-muted">
                  ({file.kind}, {file.sizeLabel})
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">
          The PDF is always attached. Other files are attached until the email reaches {budgetLabel}. Anything that does
          not fit is linked in the email.
        </p>
        {selectedBytes > attachmentBudget ? (
          <p role="status" className="mt-2 text-sm text-danger">
            The selected files are over {budgetLabel}. The email will attach what fits and link the rest.
          </p>
        ) : null}
        {state.errors?.fileIds ? <p className="mt-1 text-sm text-danger">{state.errors.fileIds}</p> : null}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={previewing || pending}
          className="rounded-md border border-line bg-card px-4 py-2 text-sm font-medium hover:border-brand-blue"
          onClick={(event) => {
            const form = event.currentTarget.form;
            if (!form) return;
            setPreviewError("");
            setPreviewing(true);
            void previewPdf(new FormData(form))
              .catch(() => setPreviewError("The preview could not be opened."))
              .finally(() => setPreviewing(false));
          }}
        >
          {previewing ? "Preparing…" : "Preview PDF"}
        </button>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}

async function previewPdf(formData: FormData) {
  const response = await fetch("/api/work-orders/preview", { method: "POST", body: formData });
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!opened) throw new Error("Pop-up blocked");
}
