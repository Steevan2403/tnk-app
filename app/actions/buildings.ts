"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseBuildingForm, type BuildingField } from "@/lib/buildings";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/data";
import { canManageBuildings } from "@/lib/roles";

export type BuildingFormState = {
  error?: string;
  errors?: Partial<Record<BuildingField, string>>;
};

export async function saveBuilding(
  _prev: BuildingFormState,
  formData: FormData,
): Promise<BuildingFormState> {
  const user = await requireUser();
  if (!canManageBuildings(user.role)) {
    return { error: "Only an admin can manage buildings." };
  }

  const parsed = parseBuildingForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const id = String(formData.get("id") ?? "").trim();
  if (id) {
    const existing = await prisma.building.findUnique({ where: { id } });
    if (!existing) return { error: "That building could not be found." };
    await prisma.building.update({ where: { id }, data: parsed.value });
  } else {
    await prisma.building.create({ data: parsed.value });
  }

  revalidatePath("/", "layout");
  redirect("/buildings");
}

export async function selectBuilding(formData: FormData) {
  const user = await requireUser();
  const buildingId = String(formData.get("buildingId") ?? "");
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { selectedBuildingId: building.id },
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
