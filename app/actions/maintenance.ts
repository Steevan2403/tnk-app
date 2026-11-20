"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatCalendarDate, formatIsoDate, parseDateOnly } from "@/lib/contractors";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import {
  isOccurrenceDate,
  maintenanceTab,
  parseMaintenanceForm,
  planMaintenanceDelete,
  removedVisitActivity,
  safeCalendarPath,
  scheduleOf,
  seriesDeletedActivity,
  sydneyToday,
  type MaintenanceField,
} from "@/lib/maintenance";
import { canManageMaintenance, canRecordOccurrence } from "@/lib/roles";
import { attachSubmitted, type SubmittedValues } from "@/lib/form-values";
import { removeUpload, saveUpload } from "@/lib/storage";

export type MaintenanceFormState = {
  error?: string;
  errors?: Partial<Record<MaintenanceField, string>>;
  values?: SubmittedValues;
};

const denied = "You do not have permission to change maintenance.";

function refresh() {
  revalidatePath("/maintenance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

async function manager() {
  const user = await requireUser();
  if (!canManageMaintenance(user.role) || !user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

async function recorder() {
  const user = await requireUser();
  if (!canRecordOccurrence(user.role) || !user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

export async function saveMaintenance(prev: MaintenanceFormState, formData: FormData): Promise<MaintenanceFormState> {
  return attachSubmitted(formData, await saveMaintenanceBody(prev, formData));
}

async function saveMaintenanceBody(_prev: MaintenanceFormState, formData: FormData): Promise<MaintenanceFormState> {
  const user = await manager();
  if (!user) return { error: denied };

  const id = String(formData.get("id") ?? "").trim();
  const existing = id
    ? await prisma.maintenanceEvent.findFirst({
        where: { id, buildingId: user.buildingId },
        include: { companies: { select: { companyId: true } }, occurrences: { select: { occursOn: true, state: true } } },
      })
    : null;
  if (id && !existing) return { error: "That maintenance event could not be found." };

  const [assets, apartments, companies] = await Promise.all([
    prisma.asset.findMany({ where: { buildingId: user.buildingId }, select: { id: true } }),
    prisma.apartment.findMany({ where: { buildingId: user.buildingId }, select: { id: true } }),
    prisma.contractorCompany.findMany({
      where: existing?.companies.length
        ? { OR: [{ status: "approved" }, { id: { in: existing.companies.map((link) => link.companyId) } }] }
        : { status: "approved" },
      select: { id: true, contacts: { select: { id: true } } },
    }),
  ]);

  const parsed = parseMaintenanceForm(formData, {
    assetIds: assets.map((asset) => asset.id),
    apartmentIds: apartments.map((apartment) => apartment.id),
    companies: companies.map((company) => ({ id: company.id, contactIds: company.contacts.map((contact) => contact.id) })),
  });
  if (!parsed.ok) return { errors: parsed.errors };

  const photos = filesFrom(formData, "photo");
  const documents = filesFrom(formData, "document");
  const stored: { kind: "photo" | "document"; name: string; storedName: string }[] = [];
  try {
    for (const file of photos) {
      const saved = await saveUpload(file, "image");
      stored.push({ kind: "photo", name: saved.originalName, storedName: saved.storedName });
    }
    for (const file of documents) {
      const saved = await saveUpload(file, "file");
      stored.push({ kind: "document", name: saved.originalName, storedName: saved.storedName });
    }
  } catch (error) {
    await Promise.all(stored.map((file) => removeUpload(file.storedName)));
    return { error: error instanceof Error ? error.message : "The file could not be saved." };
  }

  const data = {
    subject: parsed.value.subject,
    description: parsed.value.description,
    notes: parsed.value.notes,
    startDate: parsed.value.startDate,
    endDate: parsed.value.endDate,
    frequency: parsed.value.frequency,
    intervalMonths: parsed.value.intervalMonths,
    remindContractor: parsed.value.remindContractor,
    reminderDays: parsed.value.reminderDays,
    area: parsed.value.area,
    apartmentId: parsed.value.apartmentId,
  };

  try {
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.maintenanceEvent.update({ where: { id: existing.id }, data });
        await replaceLinks(tx, existing.id, parsed.value);
        if (stored.length) {
          await tx.maintenanceFile.createMany({
            data: stored.map((file) => ({ eventId: existing.id, kind: file.kind, name: file.name, storedName: file.storedName })),
          });
        }
      });
    } else {
      await prisma.maintenanceEvent.create({
        data: {
          ...data,
          buildingId: user.buildingId,
          createdById: user.id,
          assets: parsed.value.assetIds.length ? { create: parsed.value.assetIds.map((assetId) => ({ assetId })) } : undefined,
          companies: parsed.value.companyIds.length
            ? { create: parsed.value.companyIds.map((companyId) => ({ companyId })) }
            : undefined,
          contacts: parsed.value.contactIds.length
            ? { create: parsed.value.contactIds.map((contactId) => ({ contactId })) }
            : undefined,
          files: stored.length
            ? { create: stored.map((file) => ({ kind: file.kind, name: file.name, storedName: file.storedName })) }
            : undefined,
        },
      });
    }
  } catch (error) {
    console.error(error);
    await Promise.all(stored.map((file) => removeUpload(file.storedName)));
    return { error: "The maintenance event could not be saved." };
  }

  const schedule = scheduleOf({
    startDate: parsed.value.startDate,
    endDate: parsed.value.endDate,
    frequency: parsed.value.frequency,
    intervalMonths: parsed.value.intervalMonths,
  });
  const tab = schedule ? maintenanceTab(schedule, existing?.occurrences ?? [], sydneyToday()) : "active";
  refresh();
  redirect(`/maintenance?tab=${tab}`);
}

export async function deleteMaintenanceEvent(formData: FormData) {
  const returnTo = safeCalendarPath(String(formData.get("returnTo") ?? "")) || "/maintenance";
  const user = await manager();
  if (!user) redirect(returnTo);

  const eventId = String(formData.get("eventId") ?? "").trim();
  const occursOn = parseDateOnly(String(formData.get("occursOn") ?? ""));
  const event = await prisma.maintenanceEvent.findFirst({
    where: { id: eventId, buildingId: user.buildingId },
    include: {
      files: { select: { storedName: true } },
      occurrences: { select: { occursOn: true, state: true, fileStoredName: true } },
      _count: { select: { cases: true } },
    },
  });
  if (!event) redirect(returnTo);
  const plan = planMaintenanceDelete({ role: user.role, frequency: event.frequency, scope: String(formData.get("scope") ?? "") });
  if (!plan.ok) redirect(returnTo);

  if (plan.action === "occurrence") {
    if (!occursOn) redirect(returnTo);
    const schedule = scheduleOf(event);
    if (!schedule || !isOccurrenceDate(schedule, occursOn)) redirect(returnTo);
    const iso = formatIsoDate(occursOn);
    const existing = event.occurrences.find((record) => formatIsoDate(record.occursOn) === iso);
    if (existing?.state === "removed") redirect(returnTo);
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceOccurrence.upsert({
        where: { eventId_occursOn: { eventId: event.id, occursOn } },
        create: {
          eventId: event.id,
          occursOn,
          state: "removed",
          actedAt: new Date(),
          actedById: user.id,
        },
        update: {
          state: "removed",
          note: null,
          fileName: null,
          fileStoredName: null,
          actedAt: new Date(),
          actedById: user.id,
        },
      });
      await tx.buildingActivity.create({
        data: {
          buildingId: user.buildingId,
          actorId: user.id,
          summary: removedVisitActivity(event.subject, formatCalendarDate(occursOn)),
          href: `/calendar?date=${iso}`,
        },
      });
    });
    if (existing?.fileStoredName) await removeUpload(existing.fileStoredName);
    refresh();
    redirect(returnTo);
  }

  const storedNames = [
    ...event.files.map((file) => file.storedName),
    ...event.occurrences.flatMap((record) => (record.fileStoredName ? [record.fileStoredName] : [])),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.buildingActivity.create({
      data: {
        buildingId: user.buildingId,
        actorId: user.id,
        summary: seriesDeletedActivity(event.subject, event._count.cases),
        href: "/maintenance",
      },
    });
    await tx.maintenanceEvent.delete({ where: { id: event.id } });
  });
  await Promise.all(storedNames.map((storedName) => removeUpload(storedName)));
  refresh();
  redirect("/maintenance");
}

export async function deleteMaintenanceFile(formData: FormData) {
  const user = await manager();
  if (!user) redirect("/maintenance");
  const id = String(formData.get("id") ?? "");
  const event = await prisma.maintenanceFile.findFirst({
    where: { id, event: { buildingId: user.buildingId } },
    select: { id: true, eventId: true, storedName: true },
  });
  if (!event) redirect("/maintenance");
  await prisma.maintenanceFile.delete({ where: { id: event.id } });
  await removeUpload(event.storedName);
  refresh();
  redirect(`/maintenance/${event.eventId}/edit`);
}

export async function completeOccurrence(formData: FormData) {
  const returnTo = safeCalendarPath(String(formData.get("returnTo") ?? ""));
  const user = await recorder();
  if (!user) redirect(returnTo);

  const found = await findVisit(user.buildingId, formData);
  if (!found) redirect(returnTo);
  if (found.record) redirect(returnTo);

  const completedOn = parseDateOnly(String(formData.get("completedOn") ?? "")) ?? sydneyToday();
  if (completedOn.getTime() > sydneyToday().getTime()) redirect(returnTo);
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 2000) redirect(returnTo);

  const file = formData.get("file");
  let stored: { originalName: string; storedName: string } | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      stored = await saveUpload(file, "file");
    } catch {
      redirect(returnTo);
    }
  }

  try {
    await prisma.maintenanceOccurrence.create({
      data: {
        eventId: found.event.id,
        occursOn: found.occursOn,
        state: "completed",
        note: note || null,
        fileName: stored?.originalName,
        fileStoredName: stored?.storedName,
        actedAt: completedOn,
        actedById: user.id,
      },
    });
  } catch (error) {
    if (stored) await removeUpload(stored.storedName);
    if (!isUnique(error)) console.error(error);
  }

  refresh();
  redirect(returnTo);
}

export async function skipOccurrence(formData: FormData) {
  const returnTo = safeCalendarPath(String(formData.get("returnTo") ?? ""));
  const user = await recorder();
  if (!user) redirect(returnTo);
  const found = await findVisit(user.buildingId, formData);
  if (!found || found.record) redirect(returnTo);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason || reason.length > 500) redirect(returnTo);

  try {
    await prisma.maintenanceOccurrence.create({
      data: {
        eventId: found.event.id,
        occursOn: found.occursOn,
        state: "skipped",
        note: reason,
        actedAt: new Date(),
        actedById: user.id,
      },
    });
  } catch (error) {
    if (!isUnique(error)) console.error(error);
  }

  refresh();
  redirect(returnTo);
}

async function findVisit(buildingId: string, formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const occursOn = parseDateOnly(String(formData.get("occursOn") ?? ""));
  if (!eventId || !occursOn) return null;
  const event = await prisma.maintenanceEvent.findFirst({
    where: { id: eventId, buildingId },
    select: { id: true, startDate: true, endDate: true, frequency: true, intervalMonths: true },
  });
  const schedule = event ? scheduleOf(event) : null;
  if (!event || !schedule || !isOccurrenceDate(schedule, occursOn)) return null;
  const record = await prisma.maintenanceOccurrence.findUnique({
    where: { eventId_occursOn: { eventId: event.id, occursOn } },
    select: { id: true },
  });
  return { event, occursOn, record };
}

async function replaceLinks(
  tx: Prisma.TransactionClient,
  eventId: string,
  value: { assetIds: string[]; companyIds: string[]; contactIds: string[] },
) {
  await tx.maintenanceAsset.deleteMany({ where: { eventId } });
  await tx.maintenanceCompany.deleteMany({ where: { eventId } });
  await tx.maintenanceContact.deleteMany({ where: { eventId } });
  if (value.assetIds.length) {
    await tx.maintenanceAsset.createMany({ data: value.assetIds.map((assetId) => ({ eventId, assetId })) });
  }
  if (value.companyIds.length) {
    await tx.maintenanceCompany.createMany({ data: value.companyIds.map((companyId) => ({ eventId, companyId })) });
  }
  if (value.contactIds.length) {
    await tx.maintenanceContact.createMany({ data: value.contactIds.map((contactId) => ({ eventId, contactId })) });
  }
}

function filesFrom(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((file): file is File => file instanceof File && file.size > 0);
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
