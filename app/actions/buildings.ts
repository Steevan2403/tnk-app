"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { parseBuildingForm, type BuildingField } from "@/lib/buildings";
import { prisma } from "@/lib/db";
import { listBuildings, requireUser } from "@/lib/data";
import { canAssignBuildings, canManageBuildings } from "@/lib/roles";

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
  const buildings = await listBuildings();
  const building = buildings.find((item) => item.id === buildingId);
  if (!building) notFound();

  await prisma.user.update({
    where: { id: user.id },
    data: { selectedBuildingId: building.id },
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function saveUserBuildings(formData: FormData) {
  const actor = await requireUser();
  if (!canAssignBuildings(actor.role)) notFound();

  const userId = String(formData.get("userId") ?? "");
  const requested = formData.getAll("buildingId").map((value) => String(value));
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, selectedBuildingId: true },
  });
  if (!person || (person.role !== "manager" && person.role !== "staff")) notFound();

  const found = await prisma.building.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const allowed = new Set(found.map((building) => building.id));
  const buildingIds = requested.filter((id, index) => allowed.has(id) && requested.indexOf(id) === index);
  const selectedBuildingId =
    person.selectedBuildingId && buildingIds.includes(person.selectedBuildingId) ? person.selectedBuildingId : null;

  await prisma.$transaction(async (tx) => {
    await tx.userBuilding.deleteMany({ where: { userId } });
    if (buildingIds.length > 0) {
      await tx.userBuilding.createMany({
        data: buildingIds.map((buildingId) => ({ userId, buildingId })),
      });
    }
    await tx.user.update({ where: { id: userId }, data: { selectedBuildingId } });
  });

  revalidatePath("/", "layout");
  redirect("/settings/users");
}
