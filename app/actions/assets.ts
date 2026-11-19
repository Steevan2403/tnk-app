"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import {
  parseAssetForm,
  parseCategoryName,
  parseWarrantyForm,
  photoCountError,
  type AssetField,
  type CategoryField,
  type DocumentField,
  type PhotoField,
  type WarrantyField,
} from "@/lib/assets";
import { parseDocumentName } from "@/lib/contractors";
import { canManageAssetCategories, canManageAssets } from "@/lib/roles";
import { attachSubmitted, type SubmittedValues } from "@/lib/form-values";
import { fileBaseName, imageUploadProblem, removeUpload, saveUpload, uploadProblem } from "@/lib/storage";

export type AssetFormState = {
  error?: string;
  errors?: Partial<Record<AssetField, string>>;
  values?: SubmittedValues;
};

export type WarrantyFormState = {
  error?: string;
  errors?: Partial<Record<WarrantyField, string>>;
  values?: SubmittedValues;
};

export type PhotoFormState = {
  error?: string;
  errors?: Partial<Record<PhotoField, string>>;
};

export type DocumentFormState = {
  error?: string;
  errors?: Partial<Record<DocumentField, string>>;
};

export type CategoryFormState = {
  error?: string;
  errors?: Partial<Record<CategoryField, string>>;
};

const denied = "You do not have permission to change assets.";

function refresh() {
  revalidatePath("/", "layout");
}

async function editor() {
  const user = await requireUser();
  if (!canManageAssets(user.role) || !user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

async function categoryEditor() {
  const user = await requireUser();
  if (!canManageAssetCategories(user.role)) return null;
  return user;
}

function assetPath(id: string): string {
  return id ? `/building/assets/${id}` : "/building/assets";
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function money(value: string | null): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value);
}

export async function saveAsset(prev: AssetFormState, formData: FormData): Promise<AssetFormState> {
  return attachSubmitted(formData, await saveAssetBody(prev, formData));
}

async function saveAssetBody(_prev: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const id = String(formData.get("assetId") ?? "").trim();
  const existing = id
    ? await prisma.asset.findFirst({
        where: { id, buildingId: user.buildingId },
        select: { id: true, companyId: true },
      })
    : null;
  if (id && !existing) return { error: "That asset could not be found." };

  const [categories, companies] = await Promise.all([
    prisma.assetCategory.findMany({ select: { id: true } }),
    prisma.contractorCompany.findMany({
      where: existing?.companyId
        ? { OR: [{ status: "approved" }, { id: existing.companyId }] }
        : { status: "approved" },
      select: { id: true, contacts: { select: { id: true } } },
    }),
  ]);

  const parsed = parseAssetForm(formData, {
    categoryIds: categories.map((category) => category.id),
    companies: companies.map((company) => ({
      id: company.id,
      contactIds: company.contacts.map((contact) => contact.id),
    })),
  });
  if (!parsed.ok) return { errors: parsed.errors };

  const data = {
    name: parsed.value.name,
    categoryId: parsed.value.categoryId,
    location: parsed.value.location,
    make: parsed.value.make,
    model: parsed.value.model,
    serialNumber: parsed.value.serialNumber,
    barcode: parsed.value.barcode,
    purchasedOn: parsed.value.purchasedOn,
    assetValue: money(parsed.value.assetValue),
    endOfLifeValue: money(parsed.value.endOfLifeValue),
    lifeMonths: parsed.value.lifeMonths,
    description: parsed.value.description,
    companyId: parsed.value.companyId,
    contactId: parsed.value.contactId,
  };

  if (existing) {
    await prisma.asset.update({ where: { id: existing.id }, data });
    refresh();
    redirect(assetPath(existing.id));
  }

  const created = await prisma.asset.create({ data: { ...data, buildingId: user.buildingId } });
  refresh();
  redirect(assetPath(created.id));
}

export async function deleteAsset(formData: FormData) {
  const id = String(formData.get("assetId") ?? "");
  const user = await editor();
  if (!user) redirect(assetPath(id));

  const asset = await prisma.asset.findFirst({
    where: { id, buildingId: user.buildingId },
    include: {
      photos: { select: { storedName: true } },
      documents: { select: { storedName: true } },
    },
  });
  if (!asset) redirect("/building/assets");

  await prisma.asset.delete({ where: { id: asset.id } });
  await Promise.all([
    ...asset.photos.map((photo) => removeUpload(photo.storedName)),
    ...asset.documents.map((document) => removeUpload(document.storedName)),
  ]);
  refresh();
  redirect("/building/assets");
}

export async function uploadAssetPhotos(_prev: PhotoFormState, formData: FormData): Promise<PhotoFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const assetId = String(formData.get("assetId") ?? "");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, buildingId: user.buildingId },
    select: { id: true, _count: { select: { photos: true } } },
  });
  if (!asset) return { error: "That asset could not be found." };

  const files = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const countError = photoCountError(asset._count.photos, files.length);
  if (countError) return { errors: { photos: countError } };

  for (const file of files) {
    const problem = imageUploadProblem(file);
    if (problem) return { errors: { photos: problem } };
  }

  const stored: { name: string; storedName: string }[] = [];
  try {
    for (const file of files) {
      const saved = await saveUpload(file);
      stored.push({ name: fileBaseName(file.name) || saved.originalName, storedName: saved.storedName });
    }
    await prisma.assetPhoto.createMany({
      data: stored.map((file) => ({ assetId, name: file.name, storedName: file.storedName })),
    });
  } catch (error) {
    await Promise.all(stored.map((file) => removeUpload(file.storedName)));
    console.error(error);
    return { error: "The photos could not be saved." };
  }

  refresh();
  redirect(assetPath(assetId));
}

export async function deleteAssetPhoto(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const user = await editor();
  if (!user) redirect(assetPath(assetId));

  const existing = await prisma.assetPhoto.findFirst({
    where: { id: photoId, asset: { id: assetId, buildingId: user.buildingId } },
  });
  if (existing) {
    await prisma.assetPhoto.delete({ where: { id: existing.id } });
    await removeUpload(existing.storedName);
    refresh();
  }
  redirect(assetPath(assetId));
}

export async function uploadAssetDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const assetId = String(formData.get("assetId") ?? "");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!asset) return { error: "That asset could not be found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose a file." } };
  const problem = uploadProblem(file);
  if (problem) return { errors: { file: problem } };

  const named = parseDocumentName(String(formData.get("name") ?? ""), fileBaseName(file.name));
  if (!named.ok) return { errors: { name: named.error } };

  let stored: { storedName: string };
  try {
    stored = await saveUpload(file);
  } catch (error) {
    console.error(error);
    return { error: "The file could not be saved." };
  }

  try {
    await prisma.assetDocument.create({
      data: { assetId, name: named.name, storedName: stored.storedName },
    });
  } catch (error) {
    await removeUpload(stored.storedName);
    console.error(error);
    return { error: "The file could not be saved." };
  }

  refresh();
  redirect(assetPath(assetId));
}

export async function deleteAssetDocument(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const user = await editor();
  if (!user) redirect(assetPath(assetId));

  const existing = await prisma.assetDocument.findFirst({
    where: { id: documentId, asset: { id: assetId, buildingId: user.buildingId } },
  });
  if (existing) {
    await prisma.assetDocument.delete({ where: { id: existing.id } });
    await removeUpload(existing.storedName);
    refresh();
  }
  redirect(assetPath(assetId));
}

export async function saveWarranty(prev: WarrantyFormState, formData: FormData): Promise<WarrantyFormState> {
  return attachSubmitted(formData, await saveWarrantyBody(prev, formData));
}

async function saveWarrantyBody(_prev: WarrantyFormState, formData: FormData): Promise<WarrantyFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const assetId = String(formData.get("assetId") ?? "");
  const warrantyId = String(formData.get("warrantyId") ?? "").trim();
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, buildingId: user.buildingId },
    select: { id: true },
  });
  if (!asset) return { error: "That asset could not be found." };

  const parsed = parseWarrantyForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  if (warrantyId) {
    const existing = await prisma.assetWarranty.findFirst({
      where: { id: warrantyId, assetId },
      select: { id: true },
    });
    if (!existing) return { error: "That warranty could not be found." };
    await prisma.assetWarranty.update({ where: { id: warrantyId }, data: parsed.value });
  } else {
    await prisma.assetWarranty.create({ data: { ...parsed.value, assetId } });
  }

  refresh();
  redirect(assetPath(assetId));
}

export async function deleteWarranty(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const warrantyId = String(formData.get("warrantyId") ?? "");
  const user = await editor();
  if (!user) redirect(assetPath(assetId));

  await prisma.assetWarranty.deleteMany({
    where: { id: warrantyId, asset: { id: assetId, buildingId: user.buildingId } },
  });
  refresh();
  redirect(assetPath(assetId));
}

export async function addAssetCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await categoryEditor();
  if (!user) return { error: "You do not have permission to change asset categories." };

  const parsed = parseCategoryName(String(formData.get("name") ?? ""));
  if (!parsed.ok) return { errors: { name: parsed.error } };
  const taken = await categoryNameTaken(parsed.name);
  if (taken) return { errors: { name: "That category already exists." } };

  try {
    await prisma.assetCategory.create({ data: { name: parsed.name } });
  } catch (error) {
    if (isUniqueConflict(error)) return { errors: { name: "That category already exists." } };
    console.error(error);
    return { error: "The category could not be saved." };
  }

  refresh();
  return {};
}

export async function renameAssetCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await categoryEditor();
  if (!user) return { error: "You do not have permission to change asset categories." };

  const id = String(formData.get("id") ?? "");
  const parsed = parseCategoryName(String(formData.get("name") ?? ""));
  if (!parsed.ok) return { errors: { name: parsed.error } };

  const existing = await prisma.assetCategory.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "That category could not be found." };
  const taken = await categoryNameTaken(parsed.name, id);
  if (taken) return { errors: { name: "That category already exists." } };

  try {
    await prisma.assetCategory.update({ where: { id }, data: { name: parsed.name } });
  } catch (error) {
    if (isUniqueConflict(error)) return { errors: { name: "That category already exists." } };
    console.error(error);
    return { error: "The category could not be saved." };
  }

  refresh();
  return {};
}

export async function deleteAssetCategory(formData: FormData) {
  const user = await categoryEditor();
  if (!user) redirect("/building/assets");

  const id = String(formData.get("id") ?? "");
  const used = await prisma.asset.count({ where: { categoryId: id } });
  if (used === 0) {
    await prisma.assetCategory.deleteMany({ where: { id } });
    refresh();
  }
  redirect("/building/assets");
}

async function categoryNameTaken(name: string, ignoreId?: string): Promise<boolean> {
  const categories = await prisma.assetCategory.findMany({ select: { id: true, name: true } });
  const key = name.toLowerCase();
  return categories.some((category) => category.id !== ignoreId && category.name.toLowerCase() === key);
}
