"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { attachSubmitted, type SubmittedValues } from "@/lib/form-values";
import { prisma } from "@/lib/db";
import {
  parseAgentForm,
  parseApartmentForm,
  parseApartmentTab,
  parseNoteBody,
  parseOccupancy,
  parseOptionalDate,
  parseOwnerForm,
  parseResidentForm,
  parseVehicleForm,
  type AgentField,
  type ApartmentField,
  type DocumentField,
  type ImageField,
  type NoteField,
  type OwnerField,
  type ResidentField,
  type VehicleField,
} from "@/lib/residents";
import { canManageResidents } from "@/lib/roles";
import {
  fileBaseName,
  imageUploadProblem,
  removeUpload,
  saveUpload,
  uploadProblem,
} from "@/lib/storage";

export type ApartmentFormState = {
  error?: string;
  errors?: Partial<Record<ApartmentField, string>>;
  values?: SubmittedValues;
};

export type ResidentFormState = {
  error?: string;
  errors?: Partial<Record<ResidentField, string>>;
  values?: SubmittedValues;
};

export type VehicleFormState = {
  error?: string;
  errors?: Partial<Record<VehicleField, string>>;
  values?: SubmittedValues;
};

export type NoteFormState = {
  error?: string;
  errors?: Partial<Record<NoteField, string>>;
};

export type DocumentFormState = {
  error?: string;
  errors?: Partial<Record<DocumentField, string>>;
};

export type ImageFormState = {
  error?: string;
  errors?: Partial<Record<ImageField, string>>;
};

export type OwnerFormState = {
  error?: string;
  errors?: Partial<Record<OwnerField, string>>;
  values?: SubmittedValues;
};

export type AgentFormState = {
  error?: string;
  errors?: Partial<Record<AgentField, string>>;
  values?: SubmittedValues;
};

const denied = "You do not have permission to change apartments or residents.";

function refresh() {
  revalidatePath("/", "layout");
}

async function editor() {
  const user = await requireUser();
  if (!canManageResidents(user.role) || !user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

async function viewer() {
  const user = await requireUser();
  if (!user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

function readFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function apartmentPath(id: string, tab = ""): string {
  const selected = parseApartmentTab(tab);
  if (!id) return "/residents?tab=apartments";
  if (selected === "residents" || !tab) return `/residents/apartments/${id}`;
  return `/residents/apartments/${id}?tab=${selected}`;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function saveApartment(prev: ApartmentFormState, formData: FormData): Promise<ApartmentFormState> {
  return attachSubmitted(formData, await saveApartmentBody(prev, formData));
}

async function saveApartmentBody(_prev: ApartmentFormState, formData: FormData): Promise<ApartmentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const id = String(formData.get("id") ?? "").trim();
  const existing = await prisma.apartment.findMany({
    where: { buildingId: user.buildingId },
    select: { id: true, buildingId: true, number: true, lotNumber: true },
  });
  const parsed = parseApartmentForm(formData, existing, user.buildingId, id || undefined);
  if (!parsed.ok) return { errors: parsed.errors };

  if (id) {
    if (!existing.some((apartment) => apartment.id === id)) return { error: "That apartment could not be found." };
    try {
      await prisma.apartment.update({ where: { id }, data: parsed.value });
    } catch (error) {
      if (isUniqueConflict(error)) {
        return { errors: { number: "That apartment number or lot number is already used in this building." } };
      }
      console.error(error);
      return { error: "The apartment could not be saved." };
    }
    refresh();
    redirect(apartmentPath(id));
  }

  let createdId = "";
  try {
    const created = await prisma.apartment.create({
      data: { ...parsed.value, buildingId: user.buildingId },
    });
    createdId = created.id;
  } catch (error) {
    if (isUniqueConflict(error)) {
      return { errors: { number: "That apartment number or lot number is already used in this building." } };
    }
    console.error(error);
    return { error: "The apartment could not be saved." };
  }
  refresh();
  redirect(apartmentPath(createdId));
}

export async function deleteApartment(formData: FormData) {
  const id = String(formData.get("apartmentId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(id));

  const apartment = await prisma.apartment.findFirst({
    where: { id, buildingId: user.buildingId },
    include: {
      documents: { select: { storedName: true } },
      images: { select: { storedName: true } },
      vehicles: { select: { photoStoredName: true } },
    },
  });
  if (!apartment) redirect("/residents?tab=apartments");

  await prisma.apartment.delete({ where: { id: apartment.id } });
  await Promise.all([
    ...apartment.documents.map((document) => removeUpload(document.storedName)),
    ...apartment.images.map((image) => removeUpload(image.storedName)),
    ...apartment.vehicles.map((vehicle) => removeUpload(vehicle.photoStoredName)),
  ]);
  refresh();
  redirect("/residents?tab=apartments");
}

export async function setOccupancy(formData: FormData) {
  const id = String(formData.get("apartmentId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(id));

  const occupancy = parseOccupancy(String(formData.get("occupancy") ?? ""));
  const apartment = await prisma.apartment.findFirst({
    where: { id, buildingId: user.buildingId },
    select: { id: true },
  });
  if (apartment && occupancy) {
    await prisma.apartment.update({ where: { id: apartment.id }, data: { occupancy } });
    refresh();
  }
  redirect(apartmentPath(id));
}

export async function saveResident(prev: ResidentFormState, formData: FormData): Promise<ResidentFormState> {
  return attachSubmitted(formData, await saveResidentBody(prev, formData));
}

async function saveResidentBody(_prev: ResidentFormState, formData: FormData): Promise<ResidentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const residentId = String(formData.get("residentId") ?? "").trim();
  const apartmentId = String(formData.get("apartmentId") ?? "").trim();
  const apartments = await prisma.apartment.findMany({
    where: { buildingId: user.buildingId },
    select: {
      id: true,
      residents: { where: { primaryContact: true }, select: { id: true } },
    },
  });
  const selected = apartments.find((apartment) => apartment.id === apartmentId);
  const parsed = parseResidentForm(formData, {
    apartmentIds: apartments.map((apartment) => apartment.id),
    primaryResidentIds: selected?.residents.map((resident) => resident.id) ?? [],
    ignoreId: residentId || undefined,
  });
  if (!parsed.ok) return { errors: parsed.errors };

  if (residentId) {
    const existing = await prisma.resident.findFirst({
      where: { id: residentId, apartment: { buildingId: user.buildingId } },
      select: { id: true },
    });
    if (!existing) return { error: "That resident could not be found." };
    await prisma.resident.update({ where: { id: residentId }, data: parsed.value });
  } else {
    await prisma.resident.create({ data: parsed.value });
  }

  refresh();
  const returnTo = String(formData.get("returnTo") ?? "");
  if (returnTo === "apartment") redirect(apartmentPath(parsed.value.apartmentId));
  redirect("/residents");
}

export async function deleteResident(formData: FormData) {
  const residentId = String(formData.get("residentId") ?? "");
  const apartmentId = String(formData.get("apartmentId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(apartmentId));

  await prisma.resident.deleteMany({
    where: { id: residentId, apartment: { id: apartmentId, buildingId: user.buildingId } },
  });
  refresh();
  redirect(apartmentPath(apartmentId));
}

export async function addApartmentNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const user = await viewer();
  if (!user) return { error: "Select a building before adding a note." };

  const apartmentId = String(formData.get("apartmentId") ?? "");
  const parsed = parseNoteBody(String(formData.get("body") ?? ""));
  if (!parsed.ok) return { errors: { body: parsed.error } };

  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!apartment) return { error: "That apartment could not be found." };

  await prisma.apartmentNote.create({
    data: { apartmentId, body: parsed.body, authorId: user.id },
  });
  refresh();
  redirect(apartmentPath(apartmentId, String(formData.get("tab") ?? "")));
}

export async function saveVehicle(prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  return attachSubmitted(formData, await saveVehicleBody(prev, formData));
}

async function saveVehicleBody(_prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const apartmentId = String(formData.get("apartmentId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const parsed = parseVehicleForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!apartment) return { error: "That apartment could not be found." };

  const file = readFile(formData, "photo");
  if (file) {
    const problem = imageUploadProblem(file);
    if (problem) return { errors: { photo: problem } };
  }

  const existing = vehicleId
    ? await prisma.vehicle.findFirst({ where: { id: vehicleId, apartmentId } })
    : null;
  if (vehicleId && !existing) return { error: "That vehicle could not be found." };

  let stored: { storedName: string; originalName: string } | null = null;
  if (file) {
    try {
      stored = await saveUpload(file);
    } catch (error) {
      console.error(error);
      return { error: "The photo could not be saved." };
    }
  }

  const photo = stored ? { photoName: stored.originalName, photoStoredName: stored.storedName } : {};

  try {
    if (existing) {
      await prisma.vehicle.update({ where: { id: existing.id }, data: { ...parsed.value, ...photo } });
    } else {
      await prisma.vehicle.create({ data: { ...parsed.value, ...photo, apartmentId } });
    }
  } catch (error) {
    await removeUpload(stored?.storedName ?? null);
    console.error(error);
    return { error: "The vehicle could not be saved." };
  }

  if (stored && existing?.photoStoredName) await removeUpload(existing.photoStoredName);
  refresh();
  redirect(apartmentPath(apartmentId, "vehicles"));
}

export async function deleteVehicle(formData: FormData) {
  const apartmentId = String(formData.get("apartmentId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(apartmentId, "vehicles"));

  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, apartment: { id: apartmentId, buildingId: user.buildingId } },
  });
  if (existing) {
    await prisma.vehicle.delete({ where: { id: existing.id } });
    await removeUpload(existing.photoStoredName);
    refresh();
  }
  redirect(apartmentPath(apartmentId, "vehicles"));
}

export async function uploadApartmentDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const apartmentId = String(formData.get("apartmentId") ?? "");
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!apartment) return { error: "That apartment could not be found." };

  const file = readFile(formData, "file");
  if (!file) return { errors: { file: "Choose a file." } };
  const problem = uploadProblem(file);
  if (problem) return { errors: { file: problem } };

  const name = String(formData.get("name") ?? "").trim() || fileBaseName(file.name);
  if (!name) return { errors: { name: "Enter a document name." } };
  if (name.length > 180) return { errors: { name: "Use 180 characters or fewer." } };

  const expires = parseOptionalDate(String(formData.get("expiresOn") ?? ""));
  if (!expires.ok) return { errors: { expiresOn: "Enter a valid expiry date." } };

  let stored: { storedName: string };
  try {
    stored = await saveUpload(file);
  } catch (error) {
    console.error(error);
    return { error: "The file could not be saved." };
  }

  try {
    await prisma.apartmentDocument.create({
      data: { apartmentId, name, storedName: stored.storedName, expiresOn: expires.date },
    });
  } catch (error) {
    await removeUpload(stored.storedName);
    console.error(error);
    return { error: "The file could not be saved." };
  }

  refresh();
  redirect(apartmentPath(apartmentId, "documents"));
}

export async function deleteApartmentDocument(formData: FormData) {
  const apartmentId = String(formData.get("apartmentId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(apartmentId, "documents"));

  const existing = await prisma.apartmentDocument.findFirst({
    where: { id: documentId, apartment: { id: apartmentId, buildingId: user.buildingId } },
  });
  if (existing) {
    await prisma.apartmentDocument.delete({ where: { id: existing.id } });
    await removeUpload(existing.storedName);
    refresh();
  }
  redirect(apartmentPath(apartmentId, "documents"));
}

export async function uploadApartmentImages(_prev: ImageFormState, formData: FormData): Promise<ImageFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const apartmentId = String(formData.get("apartmentId") ?? "");
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!apartment) return { error: "That apartment could not be found." };

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return { errors: { files: "Choose an image." } };
  if (files.length > 10) return { errors: { files: "Upload up to 10 images at a time." } };

  for (const file of files) {
    const problem = imageUploadProblem(file);
    if (problem) return { errors: { files: problem } };
  }

  const stored: { name: string; storedName: string }[] = [];
  try {
    for (const file of files) {
      const saved = await saveUpload(file);
      stored.push({ name: fileBaseName(file.name) || saved.originalName, storedName: saved.storedName });
    }
    await prisma.apartmentImage.createMany({
      data: stored.map((file) => ({ apartmentId, name: file.name, storedName: file.storedName })),
    });
  } catch (error) {
    await Promise.all(stored.map((file) => removeUpload(file.storedName)));
    console.error(error);
    return { error: "The images could not be saved." };
  }

  refresh();
  redirect(apartmentPath(apartmentId, "images"));
}

export async function deleteApartmentImage(formData: FormData) {
  const apartmentId = String(formData.get("apartmentId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(apartmentId, "images"));

  const existing = await prisma.apartmentImage.findFirst({
    where: { id: imageId, apartment: { id: apartmentId, buildingId: user.buildingId } },
  });
  if (existing) {
    await prisma.apartmentImage.delete({ where: { id: existing.id } });
    await removeUpload(existing.storedName);
    refresh();
  }
  redirect(apartmentPath(apartmentId, "images"));
}

export async function saveOwner(prev: OwnerFormState, formData: FormData): Promise<OwnerFormState> {
  return attachSubmitted(formData, await saveOwnerBody(prev, formData));
}

async function saveOwnerBody(_prev: OwnerFormState, formData: FormData): Promise<OwnerFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const apartmentId = String(formData.get("apartmentId") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const parsed = parseOwnerForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!apartment) return { error: "That apartment could not be found." };

  if (ownerId) {
    const existing = await prisma.apartmentOwner.findFirst({
      where: { id: ownerId, apartmentId },
      select: { id: true },
    });
    if (!existing) return { error: "That owner could not be found." };
    await prisma.apartmentOwner.update({ where: { id: ownerId }, data: parsed.value });
  } else {
    await prisma.apartmentOwner.create({ data: { ...parsed.value, apartmentId } });
  }

  refresh();
  redirect(apartmentPath(apartmentId));
}

export async function deleteOwner(formData: FormData) {
  const apartmentId = String(formData.get("apartmentId") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(apartmentId));

  await prisma.apartmentOwner.deleteMany({
    where: { id: ownerId, apartment: { id: apartmentId, buildingId: user.buildingId } },
  });
  refresh();
  redirect(apartmentPath(apartmentId));
}

export async function saveAgent(prev: AgentFormState, formData: FormData): Promise<AgentFormState> {
  return attachSubmitted(formData, await saveAgentBody(prev, formData));
}

async function saveAgentBody(_prev: AgentFormState, formData: FormData): Promise<AgentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const apartmentId = String(formData.get("apartmentId") ?? "");
  const parsed = parseAgentForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!apartment) return { error: "That apartment could not be found." };

  await prisma.managingAgent.upsert({
    where: { apartmentId },
    update: parsed.value,
    create: { ...parsed.value, apartmentId },
  });
  refresh();
  redirect(apartmentPath(apartmentId));
}

export async function deleteAgent(formData: FormData) {
  const apartmentId = String(formData.get("apartmentId") ?? "");
  const user = await editor();
  if (!user) redirect(apartmentPath(apartmentId));

  await prisma.managingAgent.deleteMany({
    where: { apartmentId, apartment: { buildingId: user.buildingId } },
  });
  refresh();
  redirect(apartmentPath(apartmentId));
}
