import type { InsuranceStanding } from "@/lib/contractors";

export function InsuranceBadge({ standing }: { standing: InsuranceStanding }) {
  if (standing === "expired") {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">Expired</span>;
  }
  if (standing === "current") {
    return <span className="inline-flex rounded-full bg-[#d1fae5] px-2.5 py-0.5 text-xs font-semibold text-[#065f46]">Current</span>;
  }
  return <span className="text-sm text-muted">None</span>;
}
