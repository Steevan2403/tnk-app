"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-6 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue print:hidden"
    >
      Print
    </button>
  );
}
