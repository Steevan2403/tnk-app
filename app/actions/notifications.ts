"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/data";
import { accessibleBuildingId } from "@/lib/notifications";
import { canUseBuilding } from "@/lib/buildings";

export async function openNotification(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.notification.findFirst({
    where: { id, userId: user.id },
    select: { id: true, link: true, buildingId: true, readAt: true },
  });
  if (!row || !canUseBuilding(user.role, row.buildingId, user.buildingIds)) redirect("/notifications");
  if (!row.readAt) {
    await prisma.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
  }
  revalidatePath("/", "layout");
  redirect(appPath(row.link));
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  const buildingId = accessibleBuildingId(user);
  if (!buildingId) return;
  await prisma.notification.updateMany({
    where: { userId: user.id, buildingId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

function appPath(link: string): string {
  if (!link.startsWith("/") || link.startsWith("//") || link.includes("\\") || link.includes("://")) {
    return "/notifications";
  }
  return link;
}
