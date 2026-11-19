import type { ReactNode } from "react";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-[#e8eafc] text-[#000080]",
  in_progress: "bg-[#e5f1fb] text-[#004f99]",
  awaiting_contractor: "bg-[#fef3c7] text-[#92400e]",
  awaiting_quote: "bg-[#fef3c7] text-[#92400e]",
  awaiting_invoice: "bg-[#ffedd5] text-[#9a3412]",
  accepted: "bg-[#d1fae5] text-[#065f46]",
  completed: "bg-[#d1fae5] text-[#065f46]",
  closed: "bg-[#eef1f6] text-[#374151]",
  cancelled: "bg-[#fee2e2] text-[#991b1b]",
};

export function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? "bg-[#eef1f6] text-[#374151]";
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
      {label}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border border-dashed border-line bg-page px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-card p-4 md:p-5 ${className ?? ""}`}>
      <h2 className="border-b border-line pb-3 text-lg font-semibold tracking-tight text-brand-navy">{title}</h2>
      {children}
    </section>
  );
}
