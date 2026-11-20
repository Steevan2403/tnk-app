"use client";

import { useEffect, useState } from "react";
import { setCasesStatus } from "@/app/actions/cases";
import { SelectAll } from "@/components/case-select";
import { SelectField } from "@/components/field";
import { CASE_STATUSES, formatStatus } from "@/lib/cases";

export function CaseBulkBar({ returnTo }: { returnTo: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function sync() {
      const boxes = document.querySelectorAll<HTMLInputElement>('input[name="number"][form="case-bulk"]');
      setCount([...boxes].filter((box) => box.checked).length);
    }
    document.addEventListener("change", sync);
    sync();
    return () => document.removeEventListener("change", sync);
  }, []);

  return (
    <form id="case-bulk" action={setCasesStatus} className="mt-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="mb-3 flex items-center gap-2 text-sm md:hidden">
        <SelectAll />
        Select all
      </label>
      {count > 0 ? (
        <div className="flex flex-wrap items-end gap-3" data-bulk-status>
          <SelectField id="bulk-status" label="Change status" name="status" defaultValue="new">
            {CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            Update selected
          </button>
        </div>
      ) : null}
    </form>
  );
}
