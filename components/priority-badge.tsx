import { formatPriority } from "@/lib/cases";

const STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-danger",
  high: "bg-amber-100 text-amber-950",
  medium: "bg-[#e5f1fb] text-[#004f99]",
  low: "bg-[#eef1f6] text-[#374151]",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[priority] ?? "bg-[#eef1f6] text-[#374151]"}`}>
      {formatPriority(priority)}
    </span>
  );
}
