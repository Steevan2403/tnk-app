"use client";

import { useState, type ReactNode } from "react";

export function CaseFilters({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const name = count === 1 ? "Filters, 1 active" : `Filters, ${count} active`;

  return (
    <div className="mt-6">
      <button
        type="button"
        className="touch-target inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-brand-navy shadow-sm md:hidden"
        aria-expanded={open}
        aria-controls="case-filters"
        aria-label={name}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">Filters</span>
        <span
          aria-hidden="true"
          className="inline-flex min-w-6 justify-center rounded-full bg-brand-navy px-1.5 py-0.5 text-xs font-semibold text-white"
        >
          {count}
        </span>
      </button>
      <div id="case-filters" className={open ? "mt-3 md:mt-0" : "max-md:hidden"}>
        {children}
      </div>
    </div>
  );
}
