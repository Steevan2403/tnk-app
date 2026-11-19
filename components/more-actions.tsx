"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function MoreActions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="More actions"
        title="More actions"
        onClick={() => setOpen((current) => !current)}
        className="touch-target inline-flex items-center justify-center rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue"
      >
        …
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="More actions"
          className="absolute right-0 z-20 mt-1 min-w-44 rounded-lg border border-line bg-card p-1 shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
