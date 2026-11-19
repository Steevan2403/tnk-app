"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { columnStorageKey, hiddenColumnIds } from "@/lib/columns";

export function ColumnMenu({
  userId,
  table,
  tableId,
  columns,
  kept,
}: {
  userId: string;
  table: string;
  tableId: string;
  columns: { id: string; label: string }[];
  kept: string;
}) {
  const storageKey = columnStorageKey(userId, table);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const ids = columns.map((column) => column.id).join("\n");

  useLayoutEffect(() => {
    const next = hiddenColumnIds(window.localStorage.getItem(storageKey), ids.split("\n"));
    setHidden(next);
    applyColumns(tableId, ids.split("\n"), next);
  }, [storageKey, tableId, ids]);

  useLayoutEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function toggle(id: string) {
    const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setHidden(next);
    applyColumns(tableId, ids.split("\n"), next);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue"
      >
        Columns
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role="group"
          aria-label="Columns"
          className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-line bg-white p-3 shadow-lg"
        >
          <p className="mb-2 text-sm text-muted">{kept}</p>
          <ul className="space-y-2">
            {columns.map((column) => (
              <li key={column.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-navy"
                    checked={!hidden.includes(column.id)}
                    onChange={() => toggle(column.id)}
                  />
                  {column.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function applyColumns(tableId: string, ids: string[], hidden: string[]) {
  const root = document.getElementById(tableId);
  if (!root) return;
  const hiddenSet = new Set(hidden);
  for (const id of ids) {
    if (!id) continue;
    const hide = hiddenSet.has(id);
    root.querySelectorAll<HTMLElement>(`[data-column="${id}"]`).forEach((node) => {
      node.hidden = hide;
    });
  }
}
