"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import {
  contractorCategoryInUseMessage,
  contractorCategoryNameTaken,
  parseCompanyForm,
  parseContactForm,
  parseContractorCategoryName,
  parseDocumentName,
  parseInsuranceForm,
  parseNoteForm,
  type CompanyField,
  type ContactField,
  type DocumentField,
  type InsuranceField,
  type NoteField,
} from "@/lib/contractors";
import { canManageContractors } from "@/lib/roles";
import { fileBaseName, removeUpload, saveUpload, uploadProblem } from "@/lib/storage";

export type CompanyFormState = {
  error?: string;
  errors?: Partial<Record<CompanyField, string>>;
};

export type ContactFormState = {
  error?: string;
  errors?: Partial<Record<ContactField, string>>;
};

export type InsuranceFormState = {
  error?: string;
  errors?: Partial<Record<InsuranceField, string>>;
};

export type NoteFormState = {
  error?: string;
  errors?: Partial<Record<NoteField, string>>;
};

export type DocumentFormState = {
  error?: string;
  errors?: Partial<Record<DocumentField, string>>;
};

const denied = "You do not have permission to change contractors.";
const categoryDenied = "You do not have permission to change contractor categories.";

export type CategoryFormState = {
  error?: string;
  errors?: Partial<Record<"name", string>>;
};

function refresh() {
  revalidatePath("/", "layout");
}

async function editor() {
  const user = await requireUser();
  if (!canManageContractors(user.role)) return null;
  return user;
}

function readFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function companyPath(companyId: string): string {
  return companyId ? `/contractors/${companyId}` : "/contractors";
}

export async function saveCompany(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const parsed = parseCompanyForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const category = await prisma.contractorCategory.findUnique({
    where: { id: parsed.value.categoryId },
    select: { id: true },
  });
  if (!category) return { errors: { categoryId: "Choose a category." } };

  const id = String(formData.get("id") ?? "").trim();
  if (id) {
    const existing = await prisma.contractorCompany.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { error: "That company could not be found." };
    await prisma.contractorCompany.update({ where: { id }, data: parsed.value });
    refresh();
    redirect(`/contractors/${id}`);
  }

  const created = await prisma.contractorCompany.create({
    data: { ...parsed.value, status: "approved" },
  });
  refresh();
  redirect(`/contractors/${created.id}`);
}

export async function deleteCompany(formData: FormData) {
  const user = await editor();
  const id = String(formData.get("companyId") ?? "");
  if (!user) redirect(companyPath(id));

  const company = await prisma.contractorCompany.findUnique({
    where: { id },
    include: {
      documents: { select: { storedName: true } },
      insurances: { select: { certificateStoredName: true } },
    },
  });
  if (!company) redirect("/contractors");

  await prisma.contractorCompany.delete({ where: { id } });
  await Promise.all([
    ...company.documents.map((document) => removeUpload(document.storedName)),
    ...company.insurances.map((insurance) => removeUpload(insurance.certificateStoredName)),
  ]);
  refresh();
  redirect("/contractors");
}

export async function approveCompany(formData: FormData) {
  const id = String(formData.get("companyId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const user = await editor();
  const next = returnTo === "detail" ? companyPath(id) : "/contractors?tab=pending";
  if (!user) redirect(next);

  const existing = await prisma.contractorCompany.findUnique({ where: { id }, select: { id: true } });
  if (existing) {
    await prisma.contractorCompany.update({ where: { id }, data: { status: "approved" } });
    refresh();
  }
  redirect(next);
}

export async function addNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const companyId = String(formData.get("companyId") ?? "");
  const parsed = parseNoteForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const company = await prisma.contractorCompany.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { error: "That company could not be found." };

  await prisma.contractorNote.create({
    data: { companyId, body: parsed.value.body, authorId: user.id },
  });
  refresh();
  redirect(companyPath(companyId));
}

export async function saveContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const companyId = String(formData.get("companyId") ?? "");
  const contactId = String(formData.get("contactId") ?? "").trim();
  const parsed = parseContactForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const company = await prisma.contractorCompany.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { error: "That company could not be found." };

  if (contactId) {
    const existing = await prisma.contractorContact.findFirst({
      where: { id: contactId, companyId },
      select: { id: true },
    });
    if (!existing) return { error: "That contact could not be found." };
    await prisma.contractorContact.update({ where: { id: contactId }, data: parsed.value });
  } else {
    await prisma.contractorContact.create({ data: { ...parsed.value, companyId } });
  }

  refresh();
  redirect(companyPath(companyId));
}

export async function deleteContact(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const user = await editor();
  if (!user) redirect(companyPath(companyId));

  await prisma.contractorContact.deleteMany({ where: { id: contactId, companyId } });
  refresh();
  redirect(companyPath(companyId));
}

export async function saveInsurance(
  _prev: InsuranceFormState,
  formData: FormData,
): Promise<InsuranceFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const companyId = String(formData.get("companyId") ?? "");
  const insuranceId = String(formData.get("insuranceId") ?? "").trim();
  const parsed = parseInsuranceForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const company = await prisma.contractorCompany.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { error: "That company could not be found." };

  const file = readFile(formData, "certificate");
  if (file) {
    const problem = uploadProblem(file);
    if (problem) return { errors: { certificate: problem } };
  }

  const existing = insuranceId
    ? await prisma.contractorInsurance.findFirst({ where: { id: insuranceId, companyId } })
    : null;
  if (insuranceId && !existing) return { error: "That insurance could not be found." };

  let stored: { storedName: string; originalName: string } | null = null;
  if (file) {
    try {
      stored = await saveUpload(file);
    } catch (error) {
      console.error(error);
      return { error: "The file could not be saved." };
    }
  }

  const certificate = stored
    ? { certificateName: stored.originalName, certificateStoredName: stored.storedName }
    : {};

  try {
    if (existing) {
      await prisma.contractorInsurance.update({
        where: { id: existing.id },
        data: { ...parsed.value, ...certificate },
      });
    } else {
      await prisma.contractorInsurance.create({
        data: { ...parsed.value, ...certificate, companyId },
      });
    }
  } catch (error) {
    await removeUpload(stored?.storedName ?? null);
    console.error(error);
    return { error: "The insurance could not be saved." };
  }

  if (stored && existing?.certificateStoredName) await removeUpload(existing.certificateStoredName);
  refresh();
  redirect(companyPath(companyId));
}

export async function deleteInsurance(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const insuranceId = String(formData.get("insuranceId") ?? "");
  const user = await editor();
  if (!user) redirect(companyPath(companyId));

  const existing = await prisma.contractorInsurance.findFirst({ where: { id: insuranceId, companyId } });
  if (existing) {
    await prisma.contractorInsurance.delete({ where: { id: existing.id } });
    await removeUpload(existing.certificateStoredName);
    refresh();
  }
  redirect(companyPath(companyId));
}

export async function uploadDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const companyId = String(formData.get("companyId") ?? "");
  const company = await prisma.contractorCompany.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { error: "That company could not be found." };

  const file = readFile(formData, "file");
  if (!file) return { errors: { file: "Choose a file." } };
  const problem = uploadProblem(file);
  if (problem) return { errors: { file: problem } };

  const named = parseDocumentName(String(formData.get("name") ?? ""), fileBaseName(file.name));
  if (!named.ok) return { errors: { name: named.error } };

  let stored: { storedName: string; originalName: string };
  try {
    stored = await saveUpload(file);
  } catch (error) {
    console.error(error);
    return { error: "The file could not be saved." };
  }

  try {
    await prisma.contractorDocument.create({
      data: { companyId, name: named.name, storedName: stored.storedName },
    });
  } catch (error) {
    await removeUpload(stored.storedName);
    console.error(error);
    return { error: "The file could not be saved." };
  }

  refresh();
  redirect(companyPath(companyId));
}

export async function addContractorCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await editor();
  if (!user) return { error: categoryDenied };

  const parsed = parseContractorCategoryName(String(formData.get("name") ?? ""));
  if (!parsed.ok) return { errors: { name: parsed.error } };
  if (await categoryNameTaken(parsed.name)) return { errors: { name: "That category already exists." } };

  try {
    await prisma.contractorCategory.create({ data: { name: parsed.name } });
  } catch (error) {
    if (isUniqueConflict(error)) return { errors: { name: "That category already exists." } };
    console.error(error);
    return { error: "The category could not be saved." };
  }

  refresh();
  return {};
}

export async function renameContractorCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await editor();
  if (!user) return { error: categoryDenied };

  const id = String(formData.get("id") ?? "");
  const parsed = parseContractorCategoryName(String(formData.get("name") ?? ""));
  if (!parsed.ok) return { errors: { name: parsed.error } };

  const existing = await prisma.contractorCategory.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "That category could not be found." };
  if (await categoryNameTaken(parsed.name, id)) return { errors: { name: "That category already exists." } };

  try {
    await prisma.contractorCategory.update({ where: { id }, data: { name: parsed.name } });
  } catch (error) {
    if (isUniqueConflict(error)) return { errors: { name: "That category already exists." } };
    console.error(error);
    return { error: "The category could not be saved." };
  }

  refresh();
  return {};
}

export async function deleteContractorCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await editor();
  if (!user) return { error: categoryDenied };

  const id = String(formData.get("id") ?? "");
  const existing = await prisma.contractorCategory.findUnique({
    where: { id },
    select: { id: true, _count: { select: { companies: true } } },
  });
  if (!existing) return { error: "That category could not be found." };

  const blocked = contractorCategoryInUseMessage(existing._count.companies);
  if (blocked) return { error: blocked };

  try {
    await prisma.contractorCategory.delete({ where: { id } });
  } catch (error) {
    if (isRestrictConflict(error)) {
      const used = await prisma.contractorCompany.count({ where: { categoryId: id } });
      return { error: contractorCategoryInUseMessage(used) ?? "That category is still in use." };
    }
    console.error(error);
    return { error: "The category could not be removed." };
  }

  refresh();
  return {};
}

async function categoryNameTaken(name: string, ignoreId?: string): Promise<boolean> {
  const categories = await prisma.contractorCategory.findMany({ select: { id: true, name: true } });
  return contractorCategoryNameTaken(name, categories, ignoreId);
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRestrictConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")
  );
}

export async function deleteDocument(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const user = await editor();
  if (!user) redirect(companyPath(companyId));

  const existing = await prisma.contractorDocument.findFirst({ where: { id: documentId, companyId } });
  if (existing) {
    await prisma.contractorDocument.delete({ where: { id: existing.id } });
    await removeUpload(existing.storedName);
    refresh();
  }
  redirect(companyPath(companyId));
}
