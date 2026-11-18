import { formatPriority } from "@/lib/cases";

const STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-danger",
  high: "bg-amber-100 text-amber-900",
  medium: "bg-blue-50 text-brand-blue",
  low: "bg-gray-100 text-muted",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[priority] ?? "bg-gray-100 text-muted"}`}>
      {formatPriority(priority)}
    </span>
  );
}
