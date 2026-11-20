"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addNote,
  saveContact,
  saveInsurance,
  uploadDocument,
  type ContactFormState,
  type DocumentFormState,
  type InsuranceFormState,
  type NoteFormState,
} from "@/app/actions/contractors";
import { FileField, TextArea, TextField } from "@/components/field";
import { RetainedForm } from "@/components/retained-form";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";
const cancelClass =
  "rounded-md border border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white";

const fileAccept = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx";

export function NoteForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(addNote, {} as NoteFormState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <TextArea id="note-body" label="Note" name="body" rows={4} error={state.errors?.body} required />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}

export function ContactForm({
  companyId,
  contact,
}: {
  companyId: string;
  contact?: {
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    mobile: string | null;
    email: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveContact, {} as ContactFormState);
  return (
    <RetainedForm action={action} className="mt-4 grid gap-4 sm:grid-cols-2" values={state.values}>
      <input type="hidden" name="companyId" value={companyId} />
      {contact ? <input type="hidden" name="contactId" value={contact.id} /> : null}
      {state.error ? (
        <div className="sm:col-span-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      <TextField
        id="contact-name"
        label="Contact name"
        name="name"
        defaultValue={contact?.name}
        error={state.errors?.name}
        required
      />
      <TextField id="contact-title" label="Role" name="title" defaultValue={contact?.title ?? ""} error={state.errors?.title} />
      <TextField id="contact-phone" label="Phone" name="phone" defaultValue={contact?.phone ?? ""} error={state.errors?.phone} />
      <TextField
        id="contact-mobile"
        label="Mobile"
        name="mobile"
        defaultValue={contact?.mobile ?? ""}
        error={state.errors?.mobile}
      />
      <TextField
        id="contact-email"
        label="Email"
        name="email"
        type="email"
        defaultValue={contact?.email ?? ""}
        error={state.errors?.email}
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : contact ? "Save contact" : "Add contact"}
        </button>
        {contact ? (
          <Link href={`/contractors/${companyId}`} className={cancelClass}>
            Cancel
          </Link>
          ) : null}
      </div>
    </RetainedForm>
  );
}

export function InsuranceForm({
  companyId,
  insurance,
}: {
  companyId: string;
  insurance?: {
    id: string;
    type: string;
    policyNumber: string | null;
    insurer: string | null;
    expiresOn: string;
    certificateName: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveInsurance, {} as InsuranceFormState);
  return (
    <RetainedForm action={action} className="mt-4 grid gap-4 sm:grid-cols-2" values={state.values}>
      <input type="hidden" name="companyId" value={companyId} />
      {insurance ? <input type="hidden" name="insuranceId" value={insurance.id} /> : null}
      {state.error ? (
        <div className="sm:col-span-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      <TextField
        id="insurance-type"
        label="Insurance type"
        name="type"
        defaultValue={insurance?.type}
        error={state.errors?.type}
        placeholder="Public liability"
        required
      />
      <TextField
        id="insurance-policy"
        label="Policy number"
        name="policyNumber"
        defaultValue={insurance?.policyNumber ?? ""}
        error={state.errors?.policyNumber}
      />
      <TextField
        id="insurance-insurer"
        label="Insurer"
        name="insurer"
        defaultValue={insurance?.insurer ?? ""}
        error={state.errors?.insurer}
      />
      <TextField
        id="insurance-expiry"
        label="Expiry date"
        name="expiresOn"
        type="date"
        defaultValue={insurance?.expiresOn ?? ""}
        error={state.errors?.expiresOn}
        required
      />
      <div className="sm:col-span-2">
        <FileField
          id="insurance-certificate"
          label="Certificate"
          name="certificate"
          accept={fileAccept}
          error={state.errors?.certificate}
        />
        {insurance?.certificateName ? (
          <p className="mt-1 text-sm text-muted">Current certificate: {insurance.certificateName}. A new file replaces it.</p>
        ) : (
          <p className="mt-1 text-sm text-muted">Optional.</p>
        )}
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : insurance ? "Save insurance" : "Add insurance"}
        </button>
        {insurance ? (
          <Link href={`/contractors/${companyId}`} className={cancelClass}>
            Cancel
          </Link>
          ) : null}
      </div>
    </RetainedForm>
  );
}

export function DocumentForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(uploadDocument, {} as DocumentFormState);
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      {state.error ? (
        <div className="sm:col-span-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      <TextField id="document-name" label="Document name" name="name" error={state.errors?.name} placeholder="Optional" />
      <FileField id="document-file" label="File" name="file" accept={fileAccept} error={state.errors?.file} required />
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
