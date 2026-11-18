"use client";

import { useActionState } from "react";
import { addCaseComment, uploadCaseFile, type CaseFileFormState, type CommentFormState } from "@/app/actions/cases";
import { FileField, TextArea } from "@/components/field";
import type { CaseFileKind } from "@/lib/cases";

const buttonClass =
  "rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue disabled:opacity-60";

const ACCEPT: Record<CaseFileKind, string> = {
  photo: ".png,.jpg,.jpeg,.webp,.gif",
  video: ".mp4,.webm,.mov",
  quote: ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx",
  invoice: ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx",
  document: ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx",
};

export function CaseFileForm({
  caseNumber,
  kind,
  label,
}: {
  caseNumber: number;
  kind: CaseFileKind;
  label: string;
}) {
  const [state, action, pending] = useActionState(uploadCaseFile, {} as CaseFileFormState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="number" value={caseNumber} />
      <input type="hidden" name="kind" value={kind} />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <FileField label={label} name="file" accept={ACCEPT[kind]} error={state.errors?.file} />
      <p className="text-sm text-muted">10 MB maximum.</p>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Uploading…" : `Upload ${label.toLowerCase()}`}
      </button>
    </form>
  );
}

export function CommentForm({ caseNumber, parentId }: { caseNumber: number; parentId?: string }) {
  const [state, action, pending] = useActionState(addCaseComment, {} as CommentFormState);
  const reply = Boolean(parentId);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="number" value={caseNumber} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <TextArea label={reply ? "Reply" : "Comment"} name="body" rows={3} error={state.errors?.body} required />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : reply ? "Reply" : "Add comment"}
      </button>
    </form>
  );
}
