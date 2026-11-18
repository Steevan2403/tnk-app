import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MaintenanceForm } from "@/components/maintenance-form";
import { formatIsoDate, parseDateOnly } from "@/lib/contractors";
import { listCaseFormOptions, requireUser } from "@/lib/data";
import { sydneyToday } from "@/lib/maintenance";
import { canManageMaintenance } from "@/lib/roles";

export const metadata: Metadata = { title: "New maintenance" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canManageMaintenance(user.role) || !user.selectedBuildingId) redirect("/maintenance");
  const params = await searchParams;
  const requested = typeof params.date === "string" ? params.date : "";
  const startDate = parseDateOnly(requested) ? requested : formatIsoDate(sydneyToday());
  const options = await listCaseFormOptions(user.selectedBuildingId);

  return (
    <section>
      <Link href="/maintenance" className="text-sm text-brand-blue hover:underline">
        All maintenance
      </Link>
      <h1 className="mt-3 font-serif text-3xl">New maintenance</h1>
      <MaintenanceForm assets={options.assets} apartments={options.apartments} companies={options.companies} startDate={startDate} />
    </section>
  );
}
