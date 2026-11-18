"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAddBuildingNote,
  canDeleteBuildingNote,
  canEditBuildingNote,
  canManageUsefulNumbers,
  parseBuildingNote,
  parseUsefulNumber,
} from "@/lib/dashboard";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";

export type NoteFormState = { error?: string; errors?: { title?: string; body?: string } };

export type NumberFormState = { error?: string; errors?: { label?: string; number?: string; notes?: string } };

const noteDenied = "You do not have permission to change this note.";
const numberDenied = "You do not have permission to change useful numbers.";

function refresh() {
  revalidatePath("/dashboard");
}

async function current() {
  const user = await requireUser();
  if (!user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

export async function addBuildingNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const user = await current();
  if (!user || !canAddBuildingNote(user.role)) return { error: noteDenied };
  const parsed = parseBuildingNote(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  await prisma.buildingNote.create({
    data: {
      buildingId: user.buildingId,
      title: parsed.value.title,
      body: parsed.value.body,
      authorId: user.id,
    },
  });
  refresh();
  redirect("/dashboard");
}

export async function updateBuildingNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const user = await current();
  if (!user) return { error: noteDenied };
  const id = String(formData.get("id") ?? "").trim();
  const note = await prisma.buildingNote.findFirst({
    where: { id, buildingId: user.buildingId },
    select: { id: true, authorId: true },
  });
  if (!note || !canEditBuildingNote(user.role, note.authorId, user.id)) return { error: noteDenied };
  const parsed = parseBuildingNote(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  await prisma.buildingNote.update({
    where: { id: note.id },
    data: { title: parsed.value.title, body: parsed.value.body },
  });
  refresh();
  redirect("/dashboard");
}

export async function deleteBuildingNote(formData: FormData): Promise<void> {
  const user = await current();
  const id = String(formData.get("id") ?? "").trim();
  if (!user) redirect("/dashboard");
  const note = await prisma.buildingNote.findFirst({
    where: { id, buildingId: user.buildingId },
    select: { id: true, authorId: true },
  });
  if (!note || !canDeleteBuildingNote(user.role, note.authorId, user.id)) redirect("/dashboard");
  await prisma.buildingNote.delete({ where: { id: note.id } });
  refresh();
  redirect("/dashboard");
}

export async function addUsefulNumber(_prev: NumberFormState, formData: FormData): Promise<NumberFormState> {
  const user = await current();
  if (!user || !canManageUsefulNumbers(user.role)) return { error: numberDenied };
  const parsed = parseUsefulNumber(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  await prisma.usefulNumber.create({
    data: { buildingId: user.buildingId, ...parsed.value },
  });
  refresh();
  redirect("/dashboard");
}

export async function updateUsefulNumber(_prev: NumberFormState, formData: FormData): Promise<NumberFormState> {
  const user = await current();
  if (!user || !canManageUsefulNumbers(user.role)) return { error: numberDenied };
  const id = String(formData.get("id") ?? "").trim();
  const existing = await prisma.usefulNumber.findFirst({
    where: { id, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!existing) return { error: "That number could not be found." };
  const parsed = parseUsefulNumber(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  await prisma.usefulNumber.update({ where: { id: existing.id }, data: parsed.value });
  refresh();
  redirect("/dashboard");
}

export async function deleteUsefulNumber(formData: FormData): Promise<void> {
  const user = await current();
  const id = String(formData.get("id") ?? "").trim();
  if (!user || !canManageUsefulNumbers(user.role)) redirect("/dashboard");
  await prisma.usefulNumber.deleteMany({ where: { id, buildingId: user.buildingId } });
  refresh();
  redirect("/dashboard");
}
