"use client";

import { useId, useState, type ReactNode } from "react";

export function DeleteConfirm({
  label,
  title,
  message,
  children,
}: {
  label: string;
  title: string;
  message: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  if (!open) {
    return (
      <button type="button" className="text-sm text-danger hover:underline" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <div role="dialog" aria-labelledby={titleId} className="rounded-xl border border-line bg-card p-4 shadow-lg">
      <h3 id={titleId} className="text-base font-semibold text-brand-navy">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
      <button type="button" className="mt-3 text-sm font-medium text-brand-blue hover:underline" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

export const deleteConfirmButtonClass = "rounded-md bg-danger px-3 py-2 text-sm font-medium text-white hover:opacity-90";
