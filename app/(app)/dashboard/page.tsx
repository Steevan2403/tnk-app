import type { Metadata } from "next";
import Link from "next/link";
import { DashboardView } from "@/components/dashboard-view";
import { formatAddress } from "@/lib/buildings";
import { noteSearch, parseChartPeriod } from "@/lib/dashboard";
import { loadDashboard } from "@/lib/dashboard-data";
import { listBuildings, requireUser } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const buildings = await listBuildings();
  const building = buildings.find((item) => item.id === user.selectedBuildingId) ?? null;

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

  const data = await loadDashboard(building.id, {
    months: parseChartPeriod(first(params.months)),
    noteQuery: noteSearch(first(params.note)),
  });

  return (
    <section>
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-blue uppercase">Dashboard</p>
      <h1 className="mt-2 font-serif text-4xl">{building.name}</h1>
      <p className="mt-2 text-lg text-ink">{formatAddress(building)}</p>
      <p className="mt-4 inline-flex rounded-full bg-card px-3 py-1 text-sm text-muted shadow-sm ring-1 ring-line">
        {building.lotCount} {building.lotCount === 1 ? "lot" : "lots"}
      </p>
      <DashboardView data={data} user={{ id: user.id, role: user.role }} editNoteId={first(params.editNote)} editNumberId={first(params.editNumber)} />
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
