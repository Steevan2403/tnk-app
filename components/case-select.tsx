"use client";

export function SelectAll() {
  return (
    <input
      form="case-bulk"
      type="checkbox"
      aria-label="Select all cases on this page"
      className="size-4 accent-brand-navy"
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>('input[name="number"][form="case-bulk"]').forEach((box) => {
          if (box.checked === checked) return;
          box.checked = checked;
          box.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }}
    />
  );
}
