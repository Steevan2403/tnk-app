"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanitizeCaseHtml } from "@/lib/case-html";
import {
  caseCreatedActivity,
  changedFieldLabels,
  type CaseActivityEntry,
  commentAddedActivity,
  fieldChangeActivity,
  fileAddedActivity,
  formatIsoDate,
  isCaseFileKind,
  isCaseStatus,
  nextCaseNumber,
  parseCaseForm,
  parseCaseNumber,
  parseCaseTypeName,
  parseComment,
  safeCasesPath,
  statusChange,
  type CaseField,
  type CaseInput,
  type CaseSnapshot,
} from "@/lib/cases";
import { requireUser } from "@/lib/data";
import { maintenanceLinkFromForm } from "@/lib/maintenance-data";
import { prisma } from "@/lib/db";
import { canDeleteCases, canEditCases, canManageCaseTypes } from "@/lib/roles";
import { fileBaseName, imageUploadProblem, removeUpload, saveUpload, uploadProblem, videoUploadProblem } from "@/lib/storage";

export type CaseFormState = {
  error?: string;
  errors?: Partial<Record<CaseField, string>>;
};

export type CaseFileFormState = {
  error?: string;
  errors?: Partial<Record<"file", string>>;
};

export type CommentFormState = {
  error?: string;
  errors?: Partial<Record<"body", string>>;
};

export type CaseTypeFormState = {
  error?: string;
  errors?: Partial<Record<"name", string>>;
};

const denied = "You do not have permission to change cases.";

function refresh() {
  revalidatePath("/", "layout");
}

async function editor() {
  const user = await requireUser();
  if (!canEditCases(user.role) || !user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

async function deleter() {
  const user = await editor();
  if (!user || !canDeleteCases(user.role)) return null;
  return user;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function casePath(number: number): string {
  return `/cases/${number}`;
}

export async function saveCase(_prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const numberRaw = String(formData.get("number") ?? "").trim();
  const number = numberRaw ? parseCaseNumber(numberRaw) : null;
  const existing =
    number == null
      ? null
      : await prisma.case.findFirst({
          where: { buildingId: user.buildingId, number },
          include: {
            assets: { select: { assetId: true } },
            companies: { select: { companyId: true } },
            contacts: { select: { contactId: true } },
          },
        });
  if (numberRaw && !existing) return { error: "That case could not be found." };

  const [types, assets, apartments, companies] = await Promise.all([
    prisma.caseType.findMany({ select: { id: true } }),
    prisma.asset.findMany({ where: { buildingId: user.buildingId }, select: { id: true } }),
    prisma.apartment.findMany({ where: { buildingId: user.buildingId }, select: { id: true } }),
    prisma.contractorCompany.findMany({
      where: existing?.companies.length
        ? { OR: [{ status: "approved" }, { id: { in: existing.companies.map((link) => link.companyId) } }] }
        : { status: "approved" },
      select: { id: true, contacts: { select: { id: true } } },
    }),
  ]);

  const parsed = parseCaseForm(formData, {
    typeIds: types.map((type) => type.id),
    assetIds: assets.map((asset) => asset.id),
    apartmentIds: apartments.map((apartment) => apartment.id),
    companies: companies.map((company) => ({
      id: company.id,
      contactIds: company.contacts.map((contact) => contact.id),
    })),
  });
  if (!parsed.ok) return { errors: parsed.errors };

  const descriptionHtml = sanitizeCaseHtml(parsed.value.description);
  if (descriptionHtml.length > 20_000) return { errors: { description: "Use 20000 characters or fewer." } };

  const now = new Date();
  if (existing) {
    const change = statusChange({
      from: existing.status,
      to: parsed.value.status,
      completedAt: existing.completedAt,
      now,
    });
    if (!change) return { errors: { status: "Choose a status." } };

    const activities: CaseActivityEntry[] = [];
    if (change.activity) activities.push(change.activity);
    const fields = fieldChangeActivity(
      changedFieldLabels(snapshotFromCase(existing), snapshotFromInput(parsed.value, descriptionHtml)),
    );
    if (fields) activities.push(fields);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.case.update({
          where: { id: existing.id },
          data: {
            ...caseData(parsed.value, descriptionHtml),
            status: change.status,
            completedAt: change.completedAt,
          },
        });
        await tx.caseAsset.deleteMany({ where: { caseId: existing.id } });
        await tx.caseCompany.deleteMany({ where: { caseId: existing.id } });
        await tx.caseContact.deleteMany({ where: { caseId: existing.id } });
        if (parsed.value.assetIds.length) {
          await tx.caseAsset.createMany({
            data: parsed.value.assetIds.map((assetId) => ({ caseId: existing.id, assetId })),
          });
        }
        if (parsed.value.companyIds.length) {
          await tx.caseCompany.createMany({
            data: parsed.value.companyIds.map((companyId) => ({ caseId: existing.id, companyId })),
          });
        }
        if (parsed.value.contactIds.length) {
          await tx.caseContact.createMany({
            data: parsed.value.contactIds.map((contactId) => ({ caseId: existing.id, contactId })),
          });
        }
        if (activities.length) {
          await tx.caseActivity.createMany({
            data: activities.map((activity) => ({
              caseId: existing.id,
              actorId: user.id,
              kind: activity.kind,
              summary: activity.summary,
            })),
          });
        }
      });
    } catch (error) {
      console.error(error);
      return { error: "The case could not be saved." };
    }

    refresh();
    redirect(casePath(existing.number));
  }

  const created = caseCreatedActivity();
  const link = await maintenanceLinkFromForm(user.buildingId, formData);
  let allocated = 0;
  let saved = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const max = await prisma.case.aggregate({
      where: { buildingId: user.buildingId },
      _max: { number: true },
    });
    allocated = nextCaseNumber(max._max.number == null ? [] : [max._max.number]);
    try {
      await prisma.case.create({
        data: {
          ...caseData(parsed.value, descriptionHtml),
          buildingId: user.buildingId,
          number: allocated,
          completedAt: parsed.value.status === "completed" || parsed.value.status === "closed" ? now : null,
          createdById: user.id,
          maintenanceEventId: link?.eventId,
          occurrenceOn: link?.occursOn,
          assets: parsed.value.assetIds.length
            ? { create: parsed.value.assetIds.map((assetId) => ({ assetId })) }
            : undefined,
          companies: parsed.value.companyIds.length
            ? { create: parsed.value.companyIds.map((companyId) => ({ companyId })) }
            : undefined,
          contacts: parsed.value.contactIds.length
            ? { create: parsed.value.contactIds.map((contactId) => ({ contactId })) }
            : undefined,
          activities: { create: { actorId: user.id, kind: created.kind, summary: created.summary } },
        },
      });
      saved = true;
      break;
    } catch (error) {
      if (isUniqueConflict(error) && attempt < 2) continue;
      console.error(error);
      return { error: "The case could not be saved." };
    }
  }

  if (!saved) return { error: "The case could not be saved." };
  refresh();
  redirect(casePath(allocated));
}

export async function deleteCase(formData: FormData) {
  const number = parseCaseNumber(String(formData.get("number") ?? ""));
  const user = await deleter();
  if (!user || number == null) redirect(number ? casePath(number) : "/cases");

  const existing = await prisma.case.findFirst({
    where: { buildingId: user.buildingId, number },
    include: { files: { select: { storedName: true } } },
  });
  if (!existing) redirect("/cases");

  await prisma.case.delete({ where: { id: existing.id } });
  await Promise.all(existing.files.map((file) => removeUpload(file.storedName)));
  refresh();
  redirect("/cases");
}

export async function setCaseStatus(formData: FormData) {
  const number = parseCaseNumber(String(formData.get("number") ?? ""));
  const returnTo = safeCasesPath(String(formData.get("returnTo") ?? ""));
  const user = await editor();
  if (!user || number == null) redirect(returnTo);

  const existing = await prisma.case.findFirst({
    where: { buildingId: user.buildingId, number },
    select: { id: true, status: true, completedAt: true },
  });
  if (!existing) redirect(returnTo);

  const change = statusChange({
    from: existing.status,
    to: String(formData.get("status") ?? ""),
    completedAt: existing.completedAt,
    now: new Date(),
  });
  if (change?.activity) {
    await prisma.case.update({
      where: { id: existing.id },
      data: {
        status: change.status,
        completedAt: change.completedAt,
        activities: {
          create: { actorId: user.id, kind: change.activity.kind, summary: change.activity.summary },
        },
      },
    });
    refresh();
  }
  redirect(returnTo);
}

export async function setCasesStatus(formData: FormData) {
  const returnTo = safeCasesPath(String(formData.get("returnTo") ?? ""));
  const user = await editor();
  if (!user) redirect(returnTo);

  const status = String(formData.get("status") ?? "");
  if (!isCaseStatus(status)) redirect(returnTo);

  const numbers = [
    ...new Set(
      formData
        .getAll("number")
        .map((value) => parseCaseNumber(String(value)))
        .filter((value): value is number => value != null),
    ),
  ];
  if (numbers.length === 0) redirect(returnTo);

  const cases = await prisma.case.findMany({
    where: { buildingId: user.buildingId, number: { in: numbers } },
    select: { id: true, status: true, completedAt: true },
  });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const existing of cases) {
      const change = statusChange({ from: existing.status, to: status, completedAt: existing.completedAt, now });
      if (!change?.activity) continue;
      await tx.case.update({
        where: { id: existing.id },
        data: {
          status: change.status,
          completedAt: change.completedAt,
          activities: {
            create: { actorId: user.id, kind: change.activity.kind, summary: change.activity.summary },
          },
        },
      });
    }
  });
  refresh();
  redirect(returnTo);
}

export async function toggleCaseStar(formData: FormData) {
  const number = parseCaseNumber(String(formData.get("number") ?? ""));
  const returnTo = safeCasesPath(String(formData.get("returnTo") ?? ""));
  const user = await editor();
  if (!user || number == null) redirect(returnTo);

  const existing = await prisma.case.findFirst({
    where: { buildingId: user.buildingId, number },
    select: { id: true },
  });
  if (!existing) redirect(returnTo);

  const star = await prisma.caseStar.findUnique({
    where: { userId_caseId: { userId: user.id, caseId: existing.id } },
    select: { userId: true },
  });
  if (star) {
    await prisma.caseStar.delete({ where: { userId_caseId: { userId: user.id, caseId: existing.id } } });
  } else {
    await prisma.caseStar.create({ data: { userId: user.id, caseId: existing.id } });
  }
  refresh();
  redirect(returnTo);
}

export async function uploadCaseFile(_prev: CaseFileFormState, formData: FormData): Promise<CaseFileFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const number = parseCaseNumber(String(formData.get("number") ?? ""));
  const kind = String(formData.get("kind") ?? "");
  if (number == null || !isCaseFileKind(kind)) return { error: "That file could not be saved." };

  const existing = await prisma.case.findFirst({
    where: { buildingId: user.buildingId, number },
    select: { id: true },
  });
  if (!existing) return { error: "That case could not be found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose a file." } };
  const problem = kind === "photo" ? imageUploadProblem(file) : kind === "video" ? videoUploadProblem(file) : uploadProblem(file);
  if (problem) return { errors: { file: problem } };

  const storageKind = kind === "photo" ? "image" : kind === "video" ? "video" : "file";
  let stored: { storedName: string; originalName: string };
  try {
    stored = await saveUpload(file, storageKind);
  } catch (error) {
    console.error(error);
    return { error: "The file could not be saved." };
  }

  const name = fileBaseName(file.name) || stored.originalName;
  const activity = fileAddedActivity(kind, name);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.caseFile.create({
        data: { caseId: existing.id, kind, name, storedName: stored.storedName, uploadedById: user.id },
      });
      await tx.caseActivity.create({
        data: { caseId: existing.id, actorId: user.id, kind: activity.kind, summary: activity.summary },
      });
    });
  } catch (error) {
    await removeUpload(stored.storedName);
    console.error(error);
    return { error: "The file could not be saved." };
  }

  refresh();
  redirect(casePath(number));
}

export async function deleteCaseFile(formData: FormData) {
  const number = parseCaseNumber(String(formData.get("number") ?? ""));
  const fileId = String(formData.get("fileId") ?? "");
  const user = await deleter();
  if (!user || number == null) redirect(number ? casePath(number) : "/cases");

  const existing = await prisma.caseFile.findFirst({
    where: { id: fileId, case: { buildingId: user.buildingId, number } },
  });
  if (existing) {
    await prisma.caseFile.delete({ where: { id: existing.id } });
    await removeUpload(existing.storedName);
    refresh();
  }
  redirect(casePath(number));
}

export async function addCaseComment(_prev: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const user = await editor();
  if (!user) return { error: denied };

  const number = parseCaseNumber(String(formData.get("number") ?? ""));
  if (number == null) return { error: "That case could not be found." };
  const existing = await prisma.case.findFirst({
    where: { buildingId: user.buildingId, number },
    select: { id: true },
  });
  if (!existing) return { error: "That case could not be found." };

  const parsed = parseComment(String(formData.get("body") ?? ""));
  if (!parsed.ok) return { errors: { body: parsed.error } };

  const parentRaw = String(formData.get("parentId") ?? "").trim();
  if (parentRaw) {
    const parent = await prisma.caseComment.findFirst({
      where: { id: parentRaw, caseId: existing.id, parentId: null },
      select: { id: true },
    });
    if (!parent) return { error: "That comment could not be found." };
  }

  const activity = commentAddedActivity();
  await prisma.$transaction(async (tx) => {
    await tx.caseComment.create({
      data: {
        caseId: existing.id,
        parentId: parentRaw || null,
        body: parsed.body,
        authorId: user.id,
      },
    });
    await tx.caseActivity.create({
      data: { caseId: existing.id, actorId: user.id, kind: activity.kind, summary: activity.summary },
    });
  });

  refresh();
  redirect(casePath(number));
}

export async function addCaseType(_prev: CaseTypeFormState, formData: FormData): Promise<CaseTypeFormState> {
  const user = await requireUser();
  if (!canManageCaseTypes(user.role)) return { error: "You do not have permission to change case types." };

  const parsed = parseCaseTypeName(String(formData.get("name") ?? ""));
  if (!parsed.ok) return { errors: { name: parsed.error } };
  if (await caseTypeTaken(parsed.name)) return { errors: { name: "That case type already exists." } };

  try {
    await prisma.caseType.create({ data: { name: parsed.name } });
  } catch (error) {
    if (isUniqueConflict(error)) return { errors: { name: "That case type already exists." } };
    console.error(error);
    return { error: "The case type could not be saved." };
  }

  refresh();
  return {};
}

export async function renameCaseType(_prev: CaseTypeFormState, formData: FormData): Promise<CaseTypeFormState> {
  const user = await requireUser();
  if (!canManageCaseTypes(user.role)) return { error: "You do not have permission to change case types." };

  const id = String(formData.get("id") ?? "");
  const parsed = parseCaseTypeName(String(formData.get("name") ?? ""));
  if (!parsed.ok) return { errors: { name: parsed.error } };

  const existing = await prisma.caseType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "That case type could not be found." };
  if (await caseTypeTaken(parsed.name, id)) return { errors: { name: "That case type already exists." } };

  try {
    await prisma.caseType.update({ where: { id }, data: { name: parsed.name } });
  } catch (error) {
    if (isUniqueConflict(error)) return { errors: { name: "That case type already exists." } };
    console.error(error);
    return { error: "The case type could not be saved." };
  }

  refresh();
  return {};
}

export async function deleteCaseType(formData: FormData) {
  const user = await requireUser();
  if (!canManageCaseTypes(user.role)) redirect("/cases");

  const id = String(formData.get("id") ?? "");
  const used = await prisma.case.count({ where: { typeId: id } });
  if (used === 0) {
    await prisma.caseType.deleteMany({ where: { id } });
    refresh();
  }
  redirect("/cases");
}

async function caseTypeTaken(name: string, ignoreId?: string): Promise<boolean> {
  const types = await prisma.caseType.findMany({ select: { id: true, name: true } });
  const key = name.toLowerCase();
  return types.some((type) => type.id !== ignoreId && type.name.toLowerCase() === key);
}

function caseData(value: CaseInput, descriptionHtml: string) {
  return {
    typeId: value.typeId,
    purchaseOrderNumber: value.purchaseOrderNumber,
    startDate: value.startDate,
    dueDate: value.dueDate,
    priority: value.priority,
    status: value.status,
    subject: value.subject,
    descriptionHtml,
    internalNotes: value.internalNotes,
    includeInReport: value.includeInReport,
    area: value.area,
    apartmentId: value.apartmentId,
  };
}

function snapshotFromInput(value: CaseInput, descriptionHtml: string): CaseSnapshot {
  return {
    typeId: value.typeId,
    purchaseOrderNumber: value.purchaseOrderNumber,
    startDate: formatIsoDate(value.startDate),
    dueDate: formatIsoDate(value.dueDate),
    priority: value.priority,
    subject: value.subject,
    descriptionHtml,
    internalNotes: value.internalNotes,
    includeInReport: value.includeInReport,
    area: value.area,
    apartmentId: value.apartmentId,
    assetIds: value.assetIds,
    companyIds: value.companyIds,
    contactIds: value.contactIds,
  };
}

function snapshotFromCase(existing: {
  typeId: string;
  purchaseOrderNumber: string | null;
  startDate: Date;
  dueDate: Date;
  priority: string;
  subject: string;
  descriptionHtml: string;
  internalNotes: string | null;
  includeInReport: boolean;
  area: string;
  apartmentId: string | null;
  assets: { assetId: string }[];
  companies: { companyId: string }[];
  contacts: { contactId: string }[];
}): CaseSnapshot {
  return {
    typeId: existing.typeId,
    purchaseOrderNumber: existing.purchaseOrderNumber,
    startDate: formatIsoDate(existing.startDate),
    dueDate: formatIsoDate(existing.dueDate),
    priority: existing.priority,
    subject: existing.subject,
    descriptionHtml: existing.descriptionHtml,
    internalNotes: existing.internalNotes,
    includeInReport: existing.includeInReport,
    area: existing.area,
    apartmentId: existing.apartmentId,
    assetIds: existing.assets.map((link) => link.assetId),
    companyIds: existing.companies.map((link) => link.companyId),
    contactIds: existing.contacts.map((link) => link.contactId),
  };
}
