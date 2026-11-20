"use client";

import Link from "next/link";
import { useState } from "react";

export function CalendarAdd({
  label,
  canManage,
  maintenanceHref,
  caseHref,
}: {
  label: string;
  canManage: boolean;
  maintenanceHref: string;
  caseHref: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="day-add mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className="touch-target inline-flex size-8 items-center justify-center rounded-md text-lg leading-none font-semibold text-brand-blue hover:bg-brand-blue/10"
      >
        <span aria-hidden="true">+</span>
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-1 text-xs">
          {canManage ? (
            <Link href={maintenanceHref} className="text-brand-blue hover:underline">
              Maintenance
            </Link>
          ) : null}
          <Link href={caseHref} className="text-brand-blue hover:underline">
            Case
          </Link>
        </div>
      ) : null}
    </div>
  );
}
