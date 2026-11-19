"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanitizeCaseHtml } from "@/lib/case-html";
import { caseCreatedActivity, defaultCaseDates, fileAddedActivity, nextCaseNumber } from "@/lib/cases";
import { parseDateOnly } from "@/lib/contractors";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { flatItems, getRun, getTemplate, inspectionPdfInput, type InspectionRunRecord } from "@/lib/inspection-data";
import { buildInspectionPdf } from "@/lib/inspection-pdf";
import {
  caseFieldsFromItem,
  completionDecision,
  duplicateTemplateName,
  formatSydneyDate,
  planTemplateDelete,
  templateDeletedActivity,
  inspectionPdfName,
  isInspectionResult,
  parseReportRecipient,
  parseTemplateForm,
  planCaseCreates,
  reportMessage,
  REPAIR_CASE_TYPE,
  snapshotTemplate,
  type TemplateField,
} from "@/lib/inspections";
import { mailTransport, sendSmtp, type OutgoingMail } from "@/lib/mail";
import { notifyBuilding } from "@/lib/notifications";
import { canEditCases, canManageInspectionTemplates, canRunInspections } from "@/lib/roles";
import { copyStoredFile, imageUploadProblem, removeUpload, saveBytes, saveUpload } from "@/lib/storage";
import { mailboxFor } from "@/lib/work-order-draft";
import { attachSubmitted, type SubmittedValues } from "@/lib/form-values";

export type TemplateFormState = {
  error?: string;
  errors?: Partial<Record<TemplateField, string>>;
  values?: SubmittedValues;
};

export type ReportEmailState = {
  error?: string;
  errors?: Partial<Record<"to", string>>;
};

const templateDenied = "You do not have permission to change inspection templates.";
const runDenied = "You do not have permission to change inspections.";

function refresh() {
  revalidatePath("/", "layout");
}

async function runner() {
  const user = await requireUser();
  if (!canRunInspections(user.role) || !user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

async function templateEditor() {
  const user = await runner();
  if (!user || !canManageInspectionTemplates(user.role)) return null;
  return user;
}

function runPath(id: string): string {
  return `/building/inspections/runs/${id}`;
}

function uniqueFields(error: unknown): string[] {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return [];
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  return String(target ?? "")
    .split(/[,\s]+/)
    .filter(Boolean);
}

export async function saveTemplate(prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  return attachSubmitted(formData, await saveTemplateBody(prev, formData));
}

async function saveTemplateBody(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const user = await templateEditor();
  if (!user) return { error: templateDenied };

  const id = String(formData.get("id") ?? "").trim();
  const existing = id ? await getTemplate(user.buildingId, id) : null;
  if (id && !existing) return { error: "That template could not be found." };

  const parsed = parseTemplateForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    await prisma.$transaction(async (tx) => {
      const template = existing
        ? await tx.inspectionTemplate.update({
            where: { id: existing.id },
            data: {
              name: parsed.value.name,
              type: parsed.value.type,
              description: parsed.value.description,
            },
          })
        : await tx.inspectionTemplate.create({
            data: {
              buildingId: user.buildingId,
              name: parsed.value.name,
              type: parsed.value.type,
              description: parsed.value.description,
            },
          });
      if (existing) await tx.inspectionArea.deleteMany({ where: { templateId: template.id } });
      for (const [areaIndex, area] of parsed.value.areas.entries()) {
        await tx.inspectionArea.create({
          data: {
            templateId: template.id,
            name: area.name,
            position: areaIndex,
            items: {
              create: area.items.map((item, itemIndex) => ({
                name: item.name,
                guidance: item.guidance,
                position: itemIndex,
              })),
            },
          },
        });
      }
    });
  } catch (error) {
    console.error(error);
    return { error: "The template could not be saved." };
  }

  refresh();
  redirect("/building/inspections?tab=templates");
}

export async function deleteInspectionTemplate(formData: FormData) {
  const user = await templateEditor();
  if (!user) redirect("/building/inspections?tab=templates");
  const id = String(formData.get("id") ?? "").trim();
  const template = await prisma.inspectionTemplate.findFirst({
    where: { id, buildingId: user.buildingId },
    select: {
      id: true,
      name: true,
      runs: { select: { status: true } },
    },
  });
  if (!template) redirect("/building/inspections?tab=templates");
  if (!planTemplateDelete(user.role).ok) redirect("/building/inspections?tab=templates");
  const completedRuns = template.runs.filter((run) => run.status === "completed").length;
  const activeRuns = template.runs.filter((run) => run.status === "in_progress").length;
  await prisma.$transaction(async (tx) => {
    await tx.buildingActivity.create({
      data: {
        buildingId: user.buildingId,
        actorId: user.id,
        summary: templateDeletedActivity(template.name, completedRuns, activeRuns),
        href: "/building/inspections",
      },
    });
    await tx.inspectionTemplate.delete({ where: { id: template.id } });
  });
  refresh();
  redirect("/building/inspections?tab=templates");
}

export async function duplicateTemplate(formData: FormData) {
  const user = await templateEditor();
  const id = String(formData.get("id") ?? "").trim();
  if (!user || !id) redirect("/building/inspections?tab=templates");
  const template = await getTemplate(user.buildingId, id);
  if (!template) redirect("/building/inspections?tab=templates");

  const copy = await prisma.inspectionTemplate.create({
    data: {
      buildingId: user.buildingId,
      name: duplicateTemplateName(template.name),
      type: template.type,
      description: template.description,
      areas: {
        create: template.areas.map((area) => ({
          name: area.name,
          position: area.position,
          items: {
            create: area.items.map((item) => ({
              name: item.name,
              guidance: item.guidance,
              position: item.position,
            })),
          },
        })),
      },
    },
  });
  refresh();
  redirect(`/building/inspections/templates/${copy.id}`);
}

export async function startInspection(formData: FormData) {
  const user = await runner();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const startPath = `/building/inspections/templates/${templateId}/start`;
  if (!user || !templateId) redirect("/building/inspections?tab=templates");

  const template = await getTemplate(user.buildingId, templateId);
  if (!template) redirect("/building/inspections?tab=templates");
  const itemCount = template.areas.reduce((sum, area) => sum + area.items.length, 0);
  if (itemCount === 0) redirect(`${startPath}?error=empty`);

  const inspectedAt = parseDateOnly(String(formData.get("inspectedAt") ?? ""));
  if (!inspectedAt) redirect(`${startPath}?error=date`);

  let apartmentId: string | null = null;
  if (template.type === "private_lot") {
    const requested = String(formData.get("apartmentId") ?? "").trim();
    const apartment = requested
      ? await prisma.apartment.findFirst({
          where: { id: requested, buildingId: user.buildingId },
          select: { id: true },
        })
      : null;
    if (!apartment) redirect(`${startPath}?error=apartment`);
    apartmentId = apartment.id;
  }

  const snapshot = snapshotTemplate({
    name: template.name,
    type: template.type,
    areas: template.areas.map((area) => ({
      name: area.name,
      position: area.position,
      items: area.items.map((item) => ({
        name: item.name,
        guidance: item.guidance,
        position: item.position,
      })),
    })),
  });

  const run = await prisma.inspectionRun.create({
    data: {
      buildingId: user.buildingId,
      templateId: template.id,
      name: snapshot.name,
      type: snapshot.type,
      apartmentId,
      inspectorId: user.id,
      inspectedAt,
      status: "in_progress",
      areas: {
        create: snapshot.areas.map((area) => ({
          name: area.name,
          position: area.position,
          items: {
            create: area.items.map((item) => ({
              name: item.name,
              guidance: item.guidance,
              position: item.position,
            })),
          },
        })),
      },
    },
  });

  refresh();
  redirect(runPath(run.id));
}

export async function saveAnswer(formData: FormData) {
  const user = await runner();
  const runId = String(formData.get("runId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!user || !runId) redirect("/building/inspections?tab=progress");

  const run = await prisma.inspectionRun.findFirst({
    where: { id: runId, buildingId: user.buildingId, status: "in_progress" },
    select: { id: true },
  });
  const item = run
    ? await prisma.inspectionRunItem.findFirst({
        where: { id: itemId, area: { runId: run.id } },
        select: { id: true, result: true },
      })
    : null;
  if (!run || !item) redirect(run ? runPath(run.id) : "/building/inspections?tab=progress");

  const posted = formData.get("result");
  const result = typeof posted === "string" && isInspectionResult(posted) ? posted : item.result;
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 2000);
  const photos = formData.getAll("photo").filter((value): value is File => value instanceof File && value.size > 0);

  let photoProblem = false;
  try {
    await prisma.inspectionRunItem.update({
      where: { id: item.id },
      data: { result, comment: comment || null },
    });
    for (const photo of photos) {
      if (imageUploadProblem(photo)) {
        photoProblem = true;
        continue;
      }
      try {
        const saved = await saveUpload(photo, "image");
        await prisma.inspectionPhoto.create({
          data: { itemId: item.id, name: saved.originalName, storedName: saved.storedName },
        });
      } catch (error) {
        console.error(error);
        photoProblem = true;
      }
    }
  } catch (error) {
    console.error(error);
    redirect(`${runPath(run.id)}?error=save#item-${item.id}`);
  }

  refresh();
  const flag = photoProblem ? `?photo=${item.id}` : "";
  redirect(`${runPath(run.id)}${flag}#item-${item.id}`);
}

export async function removeInspectionPhoto(formData: FormData) {
  const user = await runner();
  const runId = String(formData.get("runId") ?? "").trim();
  const photoId = String(formData.get("photoId") ?? "").trim();
  if (!user || !runId) redirect("/building/inspections?tab=progress");

  const photo = await prisma.inspectionPhoto.findFirst({
    where: {
      id: photoId,
      item: { area: { run: { id: runId, buildingId: user.buildingId, status: "in_progress" } } },
    },
    select: { id: true, storedName: true, itemId: true },
  });
  if (!photo) redirect(runPath(runId));

  await prisma.inspectionPhoto.delete({ where: { id: photo.id } });
  await removeUpload(photo.storedName);
  refresh();
  redirect(`${runPath(runId)}#item-${photo.itemId}`);
}

export async function completeInspection(formData: FormData) {
  const user = await runner();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!user || !runId) redirect("/building/inspections?tab=progress");

  const run = await getRun(user.buildingId, runId);
  if (!run || run.status !== "in_progress") redirect(run ? runPath(run.id) : "/building/inspections?tab=progress");

  const confirmed = String(formData.get("confirmed") ?? "") === "yes";
  const decision = completionDecision(
    run.areas.flatMap((area) => area.items),
    confirmed,
  );
  if (!decision.ok) redirect(`${runPath(run.id)}?error=confirm`);

  await prisma.inspectionRun.update({
    where: { id: run.id },
    data: { status: "completed", completedAt: new Date() },
  });
  refresh();
  redirect(runPath(run.id));
}

export async function reopenInspection(formData: FormData) {
  const user = await templateEditor();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!user || !runId) redirect("/building/inspections?tab=completed");

  const run = await prisma.inspectionRun.findFirst({
    where: { id: runId, buildingId: user.buildingId, status: "completed" },
    select: { id: true },
  });
  if (!run) redirect("/building/inspections?tab=completed");

  await prisma.inspectionRun.update({
    where: { id: run.id },
    data: { status: "in_progress", completedAt: null },
  });
  refresh();
  redirect(runPath(run.id));
}

export async function createInspectionCases(formData: FormData) {
  const user = await runner();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!user || !canEditCases(user.role) || !runId) redirect(runId ? runPath(runId) : "/building/inspections");

  const run = await getRun(user.buildingId, runId);
  if (!run) redirect("/building/inspections");
  const mode = String(formData.get("mode") ?? "");
  if (mode === "all" && run.status !== "completed") redirect(runPath(run.id));

  const items = flatItems(run);
  const requested = mode === "all" ? items.map((item) => item.id) : [String(formData.get("itemId") ?? "").trim()];
  const plan = planCaseCreates(items, requested);
  if (plan.createIds.length === 0) redirect(runPath(run.id));

  const repair = await prisma.caseType.findFirst({ where: { name: REPAIR_CASE_TYPE }, select: { id: true } });
  if (!repair) redirect(`${runPath(run.id)}?error=type`);

  let failed = false;
  for (const itemId of plan.createIds) {
    const created = await createCaseForItem(user, run, itemId, repair.id);
    if (!created) failed = true;
  }

  refresh();
  redirect(failed ? `${runPath(run.id)}?error=case` : runPath(run.id));
}

export async function emailInspectionReport(_prev: ReportEmailState, formData: FormData): Promise<ReportEmailState> {
  const user = await templateEditor();
  const runId = String(formData.get("runId") ?? "").trim();
  if (!user || !runId) return { error: runDenied };

  const run = await getRun(user.buildingId, runId);
  if (!run || run.status !== "completed") return { error: "That inspection could not be found." };

  const to = parseReportRecipient(String(formData.get("to") ?? ""));
  if (!to) return { errors: { to: "Enter an email address." } };

  const input = await inspectionPdfInput(user.buildingId, run.id);
  if (!input) return { error: "That inspection could not be found." };

  const pdfName = inspectionPdfName(run.name);
  let storedName: string | null = null;
  try {
    const bytes = await buildInspectionPdf(input);
    storedName = await saveBytes(bytes, ".pdf");
    const message = reportMessage({
      inspectionName: run.name,
      buildingName: run.building.name,
      inspectorName: run.inspector.name,
      completedLabel: run.completedAt ? formatSydneyDate(run.completedAt) : input.inspectedAtLabel,
      pdfName,
    });
    const mail: OutgoingMail = {
      to,
      subject: message.subject,
      body: message.body,
      attachments: [{ name: pdfName, storedName }],
    };
    await mailboxFor(prisma).save({
      ...mail,
      attachmentNames: mail.attachments.map((attachment) => attachment.name),
      buildingId: user.buildingId,
    });
    if (mailTransport() === "smtp") {
      try {
        await sendSmtp(mail);
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    if (storedName) await removeUpload(storedName);
    console.error(error);
    return { error: "The report could not be queued." };
  }

  refresh();
  redirect(`${runPath(run.id)}?emailed=1`);
}

async function createCaseForItem(
  user: { id: string; buildingId: string },
  run: InspectionRunRecord,
  itemId: string,
  typeId: string,
): Promise<boolean> {
  const item = run.areas.flatMap((area) => area.items.map((entry) => ({ ...entry, areaName: area.name }))).find((entry) => entry.id === itemId);
  if (!item || item.result !== "fail" || item.linkedCase) return true;

  const copies: { name: string; storedName: string }[] = [];
  try {
    for (const photo of item.photos) {
      const storedName = await copyStoredFile(photo.storedName);
      if (!storedName) throw new Error("The inspection photo could not be copied.");
      copies.push({ name: photo.name, storedName });
    }

    const fields = caseFieldsFromItem({
      itemName: item.name,
      areaName: item.areaName,
      comment: item.comment,
      type: run.type,
      apartmentId: run.apartmentId,
    });
    const dates = defaultCaseDates();
    const startDate = parseDateOnly(dates.startDate);
    const dueDate = parseDateOnly(dates.dueDate);
    if (!startDate || !dueDate) throw new Error("The case dates could not be set.");
    const descriptionHtml = sanitizeCaseHtml(fields.descriptionHtml);
    const created = caseCreatedActivity();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const max = await prisma.case.aggregate({
        where: { buildingId: user.buildingId },
        _max: { number: true },
      });
      const number = nextCaseNumber(max._max.number == null ? [] : [max._max.number]);
      try {
        await prisma.$transaction(async (tx) => {
          const current = await tx.inspectionRunItem.findFirst({
            where: { id: item.id, area: { runId: run.id } },
            include: { linkedCase: { select: { id: true } } },
          });
          if (!current || current.linkedCase) throw new AlreadyLinked();
          await tx.case.create({
            data: {
              buildingId: user.buildingId,
              number,
              typeId,
              startDate,
              dueDate,
              priority: "low",
              status: "new",
              subject: fields.subject,
              descriptionHtml,
              internalNotes: `Created from inspection ${run.name}, ${item.areaName}, ${item.name}.`,
              includeInReport: true,
              area: fields.area,
              apartmentId: fields.apartmentId,
              createdById: user.id,
              inspectionItemId: item.id,
              files: copies.length
                ? {
                    create: copies.map((file) => ({
                      kind: "photo" as const,
                      name: file.name,
                      storedName: file.storedName,
                      uploadedById: user.id,
                    })),
                  }
                : undefined,
              activities: {
                create: [
                  { actorId: user.id, kind: created.kind, summary: created.summary },
                  ...copies.map((file) => {
                    const activity = fileAddedActivity("photo", file.name);
                    return { actorId: user.id, kind: activity.kind, summary: activity.summary };
                  }),
                ],
              },
            },
          });
          await notifyBuilding(tx, {
            buildingId: user.buildingId,
            actorId: user.id,
            kind: "case_created",
            title: `New case ${number}: ${fields.subject}`,
            link: `/cases/${number}`,
          });
        });
        return true;
      } catch (error) {
        if (error instanceof AlreadyLinked) {
          await Promise.all(copies.map((file) => removeUpload(file.storedName)));
          copies.length = 0;
          return true;
        }
        const fieldsHit = uniqueFields(error);
        if (fieldsHit.some((field) => field.toLowerCase().includes("inspectionitem"))) {
          await Promise.all(copies.map((file) => removeUpload(file.storedName)));
          copies.length = 0;
          return true;
        }
        if (fieldsHit.length === 0 || attempt === 2) throw error;
      }
    }
    return false;
  } catch (error) {
    await Promise.all(copies.map((file) => removeUpload(file.storedName)));
    console.error(error);
    return false;
  }
}

class AlreadyLinked extends Error {}
