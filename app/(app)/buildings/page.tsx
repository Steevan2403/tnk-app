import type { Metadata } from "next";
import Link from "next/link";
import { selectBuilding } from "@/app/actions/buildings";
import { formatAddress } from "@/lib/buildings";
import { listBuildings, requireUser } from "@/lib/data";
import { canManageBuildings } from "@/lib/roles";

export const metadata: Metadata = { title: "Buildings" };

export default async function BuildingsPage() {
  const user = await requireUser();
  const buildings = await listBuildings();
  const canManage = canManageBuildings(user.role);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Buildings</h1>
        {canManage ? (
          <Link href="/buildings/new" className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white">
            New building
          </Link>
        ) : null}
      </div>
      {buildings.length === 0 ? (
        <p className="mt-6 text-muted">No buildings yet.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-3 md:hidden">
            {buildings.map((building) => (
              <li key={building.id} className="rounded-xl border border-line bg-card p-4">
                <BuildingSummary
                  building={building}
                  selected={building.id === user.selectedBuildingId}
                  canManage={canManage}
                />
              </li>
            ))}
          </ul>
          <div className="mt-6 hidden overflow-hidden rounded-xl border border-line bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Building</th>
                  <th className="px-4 py-3 font-medium">Lots</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((building) => {
                  const selected = building.id === user.selectedBuildingId;
                  return (
                    <tr key={building.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{building.name}</p>
                        <p className="text-muted">{formatAddress(building)}</p>
                      </td>
                      <td className="px-4 py-3">{building.lotCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-3">
                          <SwitchButton buildingId={building.id} selected={selected} />
                          {canManage ? (
                            <Link href={`/buildings/${building.id}/edit`} className="text-pine hover:underline">
                              Edit
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function BuildingSummary({
  building,
  selected,
  canManage,
}: {
  building: { id: string; name: string; address: string; suburb: string; state: string; postcode: string; lotCount: number };
  selected: boolean;
  canManage: boolean;
}) {
  return (
    <div>
      <p className="font-medium">{building.name}</p>
      <p className="mt-1 text-sm text-muted">{formatAddress(building)}</p>
      <p className="mt-1 text-sm text-muted">{building.lotCount} lots</p>
      <div className="mt-3 flex gap-3">
        <SwitchButton buildingId={building.id} selected={selected} />
        {canManage ? (
          <Link href={`/buildings/${building.id}/edit`} className="text-sm text-pine hover:underline">
            Edit
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function SwitchButton({ buildingId, selected }: { buildingId: string; selected: boolean }) {
  return (
    <form action={selectBuilding}>
      <input type="hidden" name="buildingId" value={buildingId} />
      <button type="submit" disabled={selected} className="text-sm text-pine disabled:text-muted">
        {selected ? "Selected" : "Switch"}
      </button>
    </form>
  );
}
