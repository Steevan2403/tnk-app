import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BuildingForm } from "@/components/building-form";
import { requireUser } from "@/lib/data";
import { canManageBuildings } from "@/lib/roles";

export const metadata: Metadata = { title: "New building" };

export default async function NewBuildingPage() {
  const user = await requireUser();
  if (!canManageBuildings(user.role)) redirect("/buildings");

  return (
    <section>
      <h1 className="font-serif text-3xl">New building</h1>
      <BuildingForm />
    </section>
  );
}
