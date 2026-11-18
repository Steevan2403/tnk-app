import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BuildingForm } from "@/components/building-form";
import { getBuilding, requireUser } from "@/lib/data";
import { canManageBuildings } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit building" };

export default async function EditBuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageBuildings(user.role)) redirect("/buildings");

  const { id } = await params;
  const building = await getBuilding(id);
  if (!building) notFound();

  return (
    <section>
      <h1 className="font-serif text-3xl">Edit {building.name}</h1>
      <BuildingForm building={building} />
    </section>
  );
}
