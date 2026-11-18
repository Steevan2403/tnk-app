import type { Prisma, PrismaClient } from "@prisma/client";
import { formatAddress } from "./buildings";
import { getWorkOrderCase, listWorkOrderContractors } from "./data";
import type { Mailbox } from "./mail";
import type { WorkOrderPdfInput } from "./work-order-pdf";
import {
  jobAreaLabel,
  nextWorkOrderSuffix,
  parseWorkOrderForm,
  workOrderNumber,
  type WorkOrderField,
  type WorkOrderInput,
} from "./work-orders";

export type WorkOrderDraft = {
  caseId: string;
  caseNumber: number;
  caseSubject: string;
  caseType: string;
  buildingName: string;
  buildingAddress: string;
  jobArea: string;
  previewSuffix: string;
  companyId: string;
  companyName: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  message: string;
  attendingAt: Date | null;
  purchaseOrderNumber: string | null;
  accessNotes: string | null;
  files: { id: string; name: string }[];
};

export async function prepareWorkOrderDraft(
  buildingId: string,
  formData: FormData,
): Promise<
  { ok: true; draft: WorkOrderDraft } | { ok: false; error?: string; errors?: Partial<Record<WorkOrderField, string>> }
> {
  const numberRaw = String(formData.get("number") ?? "").trim();
  const number = /^[1-9]\d{0,8}$/.test(numberRaw) ? Number(numberRaw) : null;
  if (number == null) return { ok: false, error: "That case could not be found." };

  const record = await getWorkOrderCase(buildingId, number);
  if (!record) return { ok: false, error: "That case could not be found." };

  const assigned = new Set(record.companies.map((link) => link.companyId));
  const companies = await listWorkOrderContractors([...assigned]);
  const parsed = parseWorkOrderForm(formData, {
    companies: companies.map((company) => ({
      id: company.id,
      approved: company.status === "approved",
      assigned: assigned.has(company.id),
      contacts: company.contacts.map((contact) => ({ id: contact.id, email: contact.email })),
    })),
    fileIds: record.files.map((file) => file.id),
  });
  if (!parsed.ok) return parsed;

  const company = companies.find((item) => item.id === parsed.value.companyId);
  const contact = company?.contacts.find((item) => item.id === parsed.value.contactId);
  if (!company || !contact) return { ok: false, errors: { contactId: "Choose a contact of that company with an email." } };

  return {
    ok: true,
    draft: toDraft(record, company.name, contact.name, parsed.value),
  };
}

export function toPdfInput(draft: WorkOrderDraft, suffix: string, sentAt: Date): WorkOrderPdfInput {
  return {
    number: workOrderNumber(draft.caseNumber, suffix),
    sentAt,
    buildingName: draft.buildingName,
    buildingAddress: draft.buildingAddress,
    companyName: draft.companyName,
    contactName: draft.contactName,
    contactEmail: draft.contactEmail,
    caseNumber: draft.caseNumber,
    caseSubject: draft.caseSubject,
    caseType: draft.caseType,
    jobArea: draft.jobArea,
    instructions: draft.message,
    purchaseOrderNumber: draft.purchaseOrderNumber,
    attendingAt: draft.attendingAt,
    accessNotes: draft.accessNotes,
    attachmentNames: draft.files.map((file) => file.name),
  };
}

export function mailboxFor(db: Prisma.TransactionClient | PrismaClient): Mailbox {
  return {
    async save(mail) {
      const message = await db.outboxMessage.create({
        data: {
          toAddress: mail.to,
          subject: mail.subject,
          body: mail.body,
          workOrderId: mail.workOrderId,
          attachments: {
            create: mail.attachments.map((attachment) => ({
              name: attachment.name,
              storedName: attachment.storedName,
            })),
          },
        },
      });
      return { id: message.id };
    },
  };
}

function toDraft(
  record: NonNullable<Awaited<ReturnType<typeof getWorkOrderCase>>>,
  companyName: string,
  contactName: string,
  value: WorkOrderInput,
): WorkOrderDraft {
  const files = value.fileIds
    .map((id) => record.files.find((file) => file.id === id))
    .filter((file): file is NonNullable<typeof record.files>[number] => file != null);
  return {
    caseId: record.id,
    caseNumber: record.number,
    caseSubject: record.subject,
    caseType: record.type.name,
    buildingName: record.building.name,
    buildingAddress: formatAddress(record.building),
    jobArea: jobAreaLabel(
      record.area,
      record.assets.map((link) => link.asset.name).sort((a, b) => a.localeCompare(b, "en")),
      record.apartment?.number ?? null,
    ),
    previewSuffix: nextWorkOrderSuffix(record.workOrders.map((item) => item.suffix)),
    companyId: value.companyId,
    companyName,
    contactId: value.contactId,
    contactName,
    contactEmail: value.contactEmail,
    subject: value.subject,
    message: value.message,
    attendingAt: value.attendingAt,
    purchaseOrderNumber: value.purchaseOrderNumber,
    accessNotes: value.accessNotes,
    files: files.map((file) => ({ id: file.id, name: file.name })),
  };
}
