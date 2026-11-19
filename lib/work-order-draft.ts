import type { Prisma, PrismaClient } from "@prisma/client";
import { formatAddress } from "./buildings";
import { getCompanySettings } from "./company-settings";
import { formatPriority } from "./cases";
import { formatCalendarDate } from "./contractors";
import { getWorkOrderCase, listWorkOrderContractors } from "./data";
import type { Mailbox } from "./mail";
import { readStoredFile } from "./storage";
import type { WorkOrderPdfInput, WorkOrderPdfPhoto } from "./work-order-pdf";
import {
  assignedContractorLine,
  buildingLine,
  companyNameOf,
  contractorPhone,
  siteContactValue,
} from "./work-order-terms";
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
  strataPlan: string | null;
  propertyCompanyName: string;
  siteContactName: string;
  siteContactMobile: string;
  siteContactEmail: string;
  dateRequested: Date;
  dueBy: Date;
  priority: string;
  assetNames: string[];
  contractorPhone: string;
  terms: string;
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
  files: { id: string; name: string; kind: string; storedName: string }[];
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

  const settings = await getCompanySettings();
  return {
    ok: true,
    draft: toDraft(record, company.name, contact.name, contractorPhone(contact.phone, contact.mobile), parsed.value, settings),
  };
}

export function toPdfInput(
  draft: WorkOrderDraft,
  suffix: string,
  links: { viewUrl: string; checkInUrl: string },
  photos: WorkOrderPdfPhoto[],
): WorkOrderPdfInput {
  return {
    number: workOrderNumber(draft.caseNumber, suffix),
    companyName: draft.propertyCompanyName,
    buildingLine: buildingLine(draft.buildingName, draft.strataPlan),
    buildingAddress: draft.buildingAddress,
    siteContactName: draft.siteContactName,
    siteContactMobile: draft.siteContactMobile,
    siteContactEmail: draft.siteContactEmail,
    viewUrl: links.viewUrl,
    checkInUrl: links.checkInUrl,
    dateRequested: formatCalendarDate(draft.dateRequested),
    dueBy: formatCalendarDate(draft.dueBy),
    priority: formatPriority(draft.priority),
    assignedContractor: assignedContractorLine(draft.companyName, draft.contactName, draft.contractorPhone),
    subject: draft.caseSubject,
    description: draft.message,
    jobArea: draft.jobArea,
    assets: draft.assetNames.join(", "),
    photos,
    terms: draft.terms,
  };
}

export async function workOrderPhotoBytes(
  files: { name: string; kind: string; storedName: string }[],
): Promise<WorkOrderPdfPhoto[]> {
  const photos: WorkOrderPdfPhoto[] = [];
  for (const file of files) {
    if (file.kind !== "photo") continue;
    const bytes = await readStoredFile(file.storedName);
    if (!bytes) continue;
    photos.push({ name: file.name, bytes });
  }
  return photos;
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
  phone: string,
  value: WorkOrderInput,
  settings: { companyName: string; siteContactName: string; siteContactMobile: string; siteContactEmail: string; workOrderTerms: string },
): WorkOrderDraft {
  const files = value.fileIds
    .map((id) => record.files.find((file) => file.id === id))
    .filter((file): file is NonNullable<typeof record.files>[number] => file != null);
  const assetNames = record.assets.map((link) => link.asset.name).sort((a, b) => a.localeCompare(b, "en"));
  return {
    caseId: record.id,
    caseNumber: record.number,
    caseSubject: record.subject,
    caseType: record.type.name,
    buildingName: record.building.name,
    buildingAddress: formatAddress(record.building),
    strataPlan: record.building.strataPlan,
    propertyCompanyName: companyNameOf(settings.companyName),
    siteContactName: siteContactValue(record.building.siteContactName, settings.siteContactName),
    siteContactMobile: siteContactValue(record.building.siteContactMobile, settings.siteContactMobile),
    siteContactEmail: siteContactValue(record.building.siteContactEmail, settings.siteContactEmail),
    dateRequested: record.startDate,
    dueBy: record.dueDate,
    priority: record.priority,
    assetNames,
    contractorPhone: phone,
    terms: settings.workOrderTerms,
    jobArea: jobAreaLabel(record.area, assetNames, record.apartment?.number ?? null),
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
    files: files.map((file) => ({ id: file.id, name: file.name, kind: file.kind, storedName: file.storedName })),
  };
}
