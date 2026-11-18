import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { listBuildings, requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const buildings = await listBuildings();
  const selected = buildings.find((building) => building.id === user.selectedBuildingId) ?? null;

  return (
    <Shell
      user={{ name: user.name, role: user.role }}
      buildings={buildings}
      selected={selected}
    >
      {children}
    </Shell>
  );
}
