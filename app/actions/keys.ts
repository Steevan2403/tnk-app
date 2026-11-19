"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { attachSubmitted, type SubmittedValues } from "@/lib/form-values";
import {
  planKeyDelete,
  planKeySave,
  type KeyActor,
  type KeyApartment,
  type KeyField,
  type StoredKey,
} from "@/lib/keys";

export type KeyFormState = {
  error?: string;
  errors?: Partial<Record<KeyField, string>>;
  values?: SubmittedValues;
};

function refresh() {
  revalidatePath("/", "layout");
}

function keysPath(apartmentId: string): string {
  if (!apartmentId) return "/residents?tab=apartments";
  return `/residents/apartments/${apartmentId}?tab=keys`;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function loadApartment(apartmentId: string): Promise<{
  actor: KeyActor;
  apartment: KeyApartment | null;
  keys: StoredKey[];
}> {
  const user = await requireUser();
  const actor = {
    role: user.role,
    selectedBuildingId: user.selectedBuildingId,
    memberBuildingIds: user.buildingIds,
  };
  if (!apartmentId) return { actor, apartment: null, keys: [] };

  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: {
      id: true,
      buildingId: true,
      keys: { select: { id: true, number: true } },
    },
  });
  if (!apartment) return { actor, apartment: null, keys: [] };
  return {
    actor,
    apartment: { id: apartment.id, buildingId: apartment.buildingId },
    keys: apartment.keys,
  };
}

export async function saveKey(prev: KeyFormState, formData: FormData): Promise<KeyFormState> {
  return attachSubmitted(formData, await saveKeyBody(prev, formData));
}

async function saveKeyBody(_prev: KeyFormState, formData: FormData): Promise<KeyFormState> {
  const apartmentId = String(formData.get("apartmentId") ?? "").trim();
  const loaded = await loadApartment(apartmentId);
  const plan = planKeySave({ ...loaded, formData });
  if (!plan.ok) {
    if ("status" in plan) notFound();
    if ("errors" in plan) return { errors: plan.errors };
    return { error: plan.error };
  }

  try {
    if (plan.action === "create") {
      await prisma.apartmentKey.create({
        data: { apartmentId: plan.apartmentId, ...plan.value },
      });
    } else {
      await prisma.apartmentKey.update({
        where: { id: plan.keyId },
        data: plan.value,
      });
    }
  } catch (error) {
    if (isUniqueConflict(error)) {
      return { errors: { number: "That key number is already on this apartment." } };
    }
    console.error(error);
    return { error: "The key could not be saved." };
  }

  refresh();
  redirect(keysPath(apartmentId));
}

export async function deleteKey(formData: FormData) {
  const apartmentId = String(formData.get("apartmentId") ?? "").trim();
  const keyId = String(formData.get("keyId") ?? "");
  const loaded = await loadApartment(apartmentId);
  const plan = planKeyDelete({ ...loaded, keyId });
  if (!plan.ok) {
    if ("status" in plan) notFound();
    redirect(keysPath(apartmentId));
  }

  await prisma.apartmentKey.deleteMany({ where: { id: plan.keyId, apartmentId } });
  refresh();
  redirect(keysPath(apartmentId));
}
