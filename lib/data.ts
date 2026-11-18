import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import type { BuildingRecord } from "@/lib/buildings";
import { prisma } from "@/lib/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  selectedBuildingId: string | null;
};

const buildingSelect = {
  id: true,
  name: true,
  address: true,
  suburb: true,
  state: true,
  postcode: true,
  photoUrl: true,
  lotCount: true,
} as const;

export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      selectedBuildingId: true,
    },
  });

  if (!user) {
    await signOut({ redirectTo: "/sign-in" });
    redirect("/sign-in");
  }

  return user;
});

export const listBuildings = cache(async (): Promise<BuildingRecord[]> => {
  return prisma.building.findMany({
    orderBy: { name: "asc" },
    select: buildingSelect,
  });
});

export const getBuilding = cache(async (id: string): Promise<BuildingRecord | null> => {
  return prisma.building.findUnique({
    where: { id },
    select: buildingSelect,
  });
});
