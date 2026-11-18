import type { Metadata } from "next";
import Link from "next/link";
import { formatAddress } from "@/lib/buildings";
import { listBuildings, requireUser } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const buildings = await listBuildings();
  const building = buildings.find((item) => item.id === user.selectedBuildingId) ?? null;

  if (!building) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Dashboard</h1>
        <p className="mt-3 text-muted">Select a building to see it here.</p>
        <Link href="/buildings" className="mt-4 inline-block text-pine hover:underline">
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
    </section>
  );
}
