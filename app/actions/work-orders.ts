"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mailTransport, sendSmtp, type OutgoingMail } from "@/lib/mail";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { canCancelWorkOrders, canSendWorkOrders } from "@/lib/roles";
import { removeUpload, saveBytes } from "@/lib/storage";
import { mailboxFor, prepareWorkOrderDraft, toPdfInput, workOrderPhotoBytes } from "@/lib/work-order-draft";
import { buildWorkOrderPdf } from "@/lib/work-order-pdf";
import { workOrderLinks } from "@/lib/work-order-terms";
import {
  isWorkOrderStatus,
  nextWorkOrderSuffix,
  safeWorkOrdersPath,
  subjectForSuffix,
  workOrderEmailBody,
  workOrderNumber,
  workOrderPdfName,
  workOrderSentSummary,
  type WorkOrderField,
} from "@/lib/work-orders";

export type WorkOrderFormState = {
  error?: string;
  errors?: Partial<Record<WorkOrderField, string>>;
};

const denied = "You do not have permission to send work orders.";

function refresh() {
  revalidatePath("/", "layout");
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function sendWorkOrder(_prev: WorkOrderFormState, formData: FormData): Promise<WorkOrderFormState> {
  const user = await requireUser();
  if (!canSendWorkOrders(user.role) || !user.selectedBuildingId) return { error: denied };

  const prepared = await prepareWorkOrderDraft(user.selectedBuildingId, formData);
  if (!prepared.ok) return { error: prepared.error, errors: prepared.errors };
  const draft = prepared.draft;

  let storedName: string | null = null;
  let saved = false;
  let outgoing: OutgoingMail | null = null;
  try {
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      const existing = await prisma.workOrder.findMany({
        where: { caseId: draft.caseId },
        select: { suffix: true },
      });
      const suffix = nextWorkOrderSuffix(existing.map((item) => item.suffix));
      const subject = subjectForSuffix(draft.subject, draft.caseNumber, draft.previewSuffix, suffix, draft.caseSubject);
      const number = workOrderNumber(draft.caseNumber, suffix);
      const pdfName = workOrderPdfName(draft.caseNumber, suffix);
      const sentAt = new Date();
      const id = randomUUID();
      const photos = await workOrderPhotoBytes(draft.files);
      const bytes = await buildWorkOrderPdf(toPdfInput({ ...draft, subject }, suffix, workOrderLinks(id), photos));
      storedName = await saveBytes(bytes, ".pdf");
      const mail: OutgoingMail = {
        to: draft.contactEmail,
        subject,
        body: workOrderEmailBody({
          number,
          buildingName: draft.buildingName,
          companyName: draft.companyName,
          contactName: draft.contactName,
          message: draft.message,
          pdfName,
        }),
        attachments: [{ name: pdfName, storedName }],
      };
      try {
        await prisma.$transaction(async (tx) => {
          const created = await tx.workOrder.create({
            data: {
              id,
              caseId: draft.caseId,
              suffix,
              companyId: draft.companyId,
              companyName: draft.companyName,
              contactId: draft.contactId,
              contactName: draft.contactName,
              contactEmail: draft.contactEmail,
              subject,
              message: draft.message,
              attendingAt: draft.attendingAt,
              purchaseOrderNumber: draft.purchaseOrderNumber,
              accessNotes: draft.accessNotes,
              status: "new",
              sentAt,
              sentById: user.id,
              pdfStoredName: storedName!,
              pdfName,
              files: draft.files.length ? { create: draft.files.map((file) => ({ caseFileId: file.id })) } : undefined,
            },
          });
          await tx.caseActivity.create({
            data: {
              caseId: draft.caseId,
              actorId: user.id,
              kind: "work_order_sent",
              summary: workOrderSentSummary(number, draft.companyName, draft.contactName),
            },
          });
          await mailboxFor(tx).save({ ...mail, attachmentNames: mail.attachments.map((item) => item.name), workOrderId: created.id });
        });
        outgoing = mail;
        saved = true;
      } catch (error) {
        await removeUpload(storedName);
        storedName = null;
        if (!isUniqueConflict(error)) throw error;
      }
    }
  } catch (error) {
    if (storedName) await removeUpload(storedName);
    console.error(error);
    return { error: "The work order could not be sent." };
  }

  if (saved && outgoing && mailTransport() === "smtp") {
    try {
      await sendSmtp(outgoing);
    } catch (error) {
      console.error(error);
    }
  }

  if (!saved) return { error: "The work order could not be sent." };
  refresh();
  redirect(`/cases/${draft.caseNumber}`);
}

export async function setWorkOrderStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const returnTo = safeWorkOrdersPath(String(formData.get("returnTo") ?? ""));
  const user = await requireUser();
  if (!canSendWorkOrders(user.role) || !user.selectedBuildingId || !id) redirect(returnTo);

  const next = String(formData.get("status") ?? "");
  if (!isWorkOrderStatus(next)) redirect(returnTo);
  if (next === "cancelled" && !canCancelWorkOrders(user.role)) redirect(returnTo);

  const existing = await prisma.workOrder.findFirst({
    where: { id, case: { buildingId: user.selectedBuildingId } },
    select: { id: true, status: true },
  });
  if (!existing || existing.status === next) redirect(returnTo);

  // Changing a work order does not change the case, even when every work order is completed.
  await prisma.workOrder.update({ where: { id: existing.id }, data: { status: next } });
  refresh();
  redirect(returnTo);
}
