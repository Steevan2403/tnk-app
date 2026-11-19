"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  decideSiteAction,
  INVALID_CHECK_IN_LINK,
  isCheckInToken,
  isSiteAction,
  optionalLocation,
} from "@/lib/check-in";
import { prisma } from "@/lib/db";
import { notifyBuilding } from "@/lib/notifications";
import { workOrderNumber } from "@/lib/work-orders";

export type CheckInFormState = { error?: string };

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function recordSiteVisit(_prev: CheckInFormState, formData: FormData): Promise<CheckInFormState> {
  const token = String(formData.get("token") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!isCheckInToken(token)) return { error: INVALID_CHECK_IN_LINK };
  if (!isSiteAction(action)) return { error: "That action is not available." };

  const location = optionalLocation(String(formData.get("latitude") ?? ""), String(formData.get("longitude") ?? ""));

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findUnique({
        where: { checkInToken: token },
        select: {
          id: true,
          suffix: true,
          status: true,
          case: { select: { number: true, buildingId: true } },
          visits: { where: { checkedOutAt: null }, select: { id: true, contractorName: true }, take: 1 },
        },
      });
      if (!order) return { error: INVALID_CHECK_IN_LINK };

      const decision = decideSiteAction({
        status: order.status,
        action,
        hasOpenVisit: order.visits.length > 0,
        name: String(formData.get("name") ?? ""),
      });
      if (!decision.ok) return { error: decision.error };

      const now = new Date();
      const number = workOrderNumber(order.case.number, order.suffix);
      const link = `/work-orders/${order.id}`;
      if (action === "check_in") {
        await tx.workOrderVisit.create({
          data: {
            workOrderId: order.id,
            contractorName: decision.name,
            checkedInAt: now,
            checkInLatitude: location?.latitude,
            checkInLongitude: location?.longitude,
            openKey: order.id,
          },
        });
        await notifyBuilding(tx, {
          buildingId: order.case.buildingId,
          actorId: null,
          kind: "check_in",
          title: `${decision.name} checked in on site for work order ${number}.`,
          link,
        });
      } else {
        const open = order.visits[0];
        if (!open) return { error: "Check in before checking out." };
        await tx.workOrderVisit.update({
          where: { id: open.id },
          data: {
            checkedOutAt: now,
            checkOutLatitude: location?.latitude,
            checkOutLongitude: location?.longitude,
            openKey: null,
          },
        });
        await notifyBuilding(tx, {
          buildingId: order.case.buildingId,
          actorId: null,
          kind: "check_out",
          title: `${open.contractorName} checked out of work order ${number}.`,
          link,
        });
      }

      return { id: order.id, caseNumber: order.case.number };
    });

    if ("error" in saved) return { error: saved.error };
    revalidatePath(`/check-in/${token}`);
    revalidatePath(`/work-orders/${saved.id}`);
    revalidatePath(`/cases/${saved.caseNumber}`);
    revalidatePath("/work-orders");
    revalidatePath("/dashboard");
    return {};
  } catch (error) {
    if (isUniqueConflict(error)) return { error: "You are already checked in. Check out when you leave." };
    console.error(error);
    return { error: "The check-in could not be saved. Try again." };
  }
}
