import type { InsuranceStanding } from "@/lib/contractors";

export function InsuranceBadge({ standing }: { standing: InsuranceStanding }) {
  if (standing === "expired") {
    return <span className="rounded bg-red-50 px-2 py-0.5 font-medium text-danger">Expired</span>;
  }
  if (standing === "current") {
    return <span className="rounded bg-brand-green px-2 py-0.5 font-medium text-brand-navy">Current</span>;
  }
  return <span className="text-muted">None</span>;
}
