import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth";
import { Shell } from "@/components/shell";
import { listBuildings, requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const buildings = await listBuildings();
  if (user.role !== "admin" && buildings.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center px-6 py-24">
        <div>
          <h1 className="font-serif text-3xl">{"You haven't been given access to a building yet, ask an admin"}</h1>
          <form action={signOutAction} className="mt-6">
            <button type="submit" className="text-sm font-medium text-brand-blue hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const selected = buildings.find((building) => building.id === user.selectedBuildingId) ?? null;

  return (
    <Shell user={{ name: user.name, role: user.role }} buildings={buildings} selected={selected}>
      {children}
    </Shell>
  );
}
