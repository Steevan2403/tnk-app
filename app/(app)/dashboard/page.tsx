import type { Metadata } from "next";
import Link from "next/link";
import { formatAddress } from "@/lib/buildings";
import { listBuildings, requireUser } from "@/lib/data";
import { overdueVisitsForBuilding } from "@/lib/maintenance-data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const buildings = await listBuildings();
  const building = buildings.find((item) => item.id === user.selectedBuildingId) ?? null;
  const overdue = building ? await overdueVisitsForBuilding(building.id) : [];

  if (!building) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Dashboard</h1>
        <p className="mt-3 text-muted">Select a building to see it here.</p>
        <Link href="/buildings" className="mt-4 inline-block text-brand-blue hover:underline">
          Manage buildings
        </Link>
      </section>
    );
  }

  return (
    <section>
      <p className="text-sm font-medium tracking-wide text-muted uppercase">Dashboard</p>
      <h1 className="mt-2 font-serif text-4xl">{building.name}</h1>
      <p className="mt-3 text-lg">{formatAddress(building)}</p>
      <p className="mt-6 text-muted">
        {building.lotCount} {building.lotCount === 1 ? "lot" : "lots"}
      </p>
      <div className="mt-8 max-w-md rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-medium text-brand-navy">Maintenance</h2>
        <p className="mt-2">
          {overdue.length === 0
            ? "No overdue maintenance."
            : `${overdue.length} overdue maintenance ${overdue.length === 1 ? "visit" : "visits"}`}
        </p>
        <Link href="/maintenance?tab=overdue" className="mt-3 inline-block text-sm text-brand-blue hover:underline">
          Open maintenance
        </Link>
      </div>
    </section>
  );
}
