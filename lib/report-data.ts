import { formatAddress } from "./buildings";
import { formatArea, formatPriority, formatStatus } from "./cases";
import { formatCalendarDate, formatDateTime, formatIsoDate } from "./contractors";
import { prisma } from "./db";
import { formatSydneyDate, resultCounts } from "./inspections";
import { buildManagementDocx } from "./report-docx";
import { buildManagementPdf, type ManagementReportPdfInput, type ReportPdfCase, type ReportPdfInspection } from "./report-pdf";
import { buildManagementXlsx } from "./report-xlsx";
import {
  htmlToPlain,
  inspectionsInPeriod,
  maintenanceEventsForReport,
  optionsJson,
  periodLabel,
  reportFileExtension,
  reportFileName,
  reportFormatLabel,
  reportVisits,
  selectReportCases,
  summariseReport,
  visitStatusLabel,
  type ReportCase,
  type ReportFileFormat,
  type ReportSections,
  type ReportSelection,
} from "./reports";
import { readStoredFile, removeUpload, saveBytes } from "./storage";
import { formatWorkOrderStatus, workOrderNumber } from "./work-orders";

const PHOTO_LIMIT = 4;
const PHOTO_BYTES = 1_500_000;

export type CatalogCase = {
  id: string;
  number: number;
  startDate: string;
  completedLabel: string;
  subject: string;
  typeId: string;
  typeName: string;
  status: string;
  priority: string;
  includeInReport: boolean;
  companyIds: string[];
  companyNames: string[];
  assetIds: string[];
  apartmentId: string | null;
};

export type CatalogOption = { id: string; label: string };

export type ListedReport = {
  id: string;
  periodLabel: string;
  format: ReportFileFormat;
  formatLabel: string;
  fileName: string;
  createdAt: Date;
  createdLabel: string;
  createdByName: string;
};

export async function loadReportCatalog(buildingId: string): Promise<{
  cases: CatalogCase[];
  types: CatalogOption[];
  companies: CatalogOption[];
  assets: CatalogOption[];
  apartments: CatalogOption[];
  reports: ListedReport[];
}> {
  const [cases, types, companies, assets, apartments, reports] = await Promise.all([
    loadCandidates(buildingId),
    prisma.caseType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contractorCompany.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.asset.findMany({ where: { buildingId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.apartment.findMany({ where: { buildingId }, orderBy: { number: "asc" }, select: { id: true, number: true } }),
    prisma.generatedReport.findMany({
      where: { buildingId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        periodFrom: true,
        periodTo: true,
        format: true,
        fileName: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  return {
    cases: cases.map(toCatalogCase),
    types: types.map((item) => ({ id: item.id, label: item.name })),
    companies: companies.map((item) => ({ id: item.id, label: item.name })),
    assets: assets.map((item) => ({ id: item.id, label: item.name })),
    apartments: apartments.map((item) => ({ id: item.id, label: item.number })),
    reports: reports.map((report) => ({
      id: report.id,
      periodLabel: periodLabel(report.periodFrom, report.periodTo),
      format: report.format,
      formatLabel: reportFormatLabel(report.format),
      fileName: report.fileName,
      createdAt: report.createdAt,
      createdLabel: formatDateTime(report.createdAt),
      createdByName: report.createdBy.name,
    })),
  };
}

export async function createGeneratedReport(input: {
  id?: string;
  buildingId: string;
  userId: string;
  userName: string;
  selection: ReportSelection;
  sections: ReportSections;
  format: ReportFileFormat;
  preparedAt?: Date;
}): Promise<{ id: string }> {
  const preparedAt = input.preparedAt ?? new Date();
  const report = await managementReportInput({
    buildingId: input.buildingId,
    userName: input.userName,
    selection: input.selection,
    sections: input.sections,
    preparedAt,
  });
  const fileName = reportFileName(input.selection.from, input.selection.to, input.format);
  const extension = reportFileExtension(input.format);
  const bytes = await renderManagementReport(input.format, report);

  let storedName: string | null = null;
  try {
    storedName = await saveBytes(bytes, extension);
    const data = {
      buildingId: input.buildingId,
      periodFrom: input.selection.from,
      periodTo: input.selection.to,
      optionsJson: optionsJson(input.selection, input.sections),
      format: input.format,
      fileName,
      storedName,
      createdById: input.userId,
    };
    if (input.id) {
      const existing = await prisma.generatedReport.findUnique({
        where: { id: input.id },
        select: { storedName: true },
      });
      await prisma.generatedReport.upsert({
        where: { id: input.id },
        update: data,
        create: { id: input.id, ...data },
      });
      if (existing && existing.storedName !== storedName) await removeUpload(existing.storedName);
      return { id: input.id };
    }
    const created = await prisma.generatedReport.create({ data });
    return { id: created.id };
  } catch (error) {
    if (storedName) await removeUpload(storedName);
    throw error;
  }
}

async function managementReportInput(input: {
  buildingId: string;
  userName: string;
  selection: ReportSelection;
  sections: ReportSections;
  preparedAt: Date;
}): Promise<ManagementReportPdfInput> {
  const building = await prisma.building.findUnique({
    where: { id: input.buildingId },
    select: { name: true, address: true, suburb: true, state: true, postcode: true },
  });
  if (!building) throw new Error("That building could not be found.");

  const selected = selectReportCases(await loadCandidates(input.buildingId), input.selection);
  const events = await prisma.maintenanceEvent.findMany({
    where: { buildingId: input.buildingId },
    select: {
      subject: true,
      startDate: true,
      endDate: true,
      frequency: true,
      intervalMonths: true,
      occurrences: { select: { occursOn: true, state: true } },
    },
  });
  const visits = reportVisits(maintenanceEventsForReport(events), input.selection.from, input.selection.to, input.preparedAt);
  const runs = await loadInspectionRuns(input.buildingId);
  const inspections = inspectionsInPeriod(runs, input.selection.from, input.selection.to);
  return {
    buildingName: building.name,
    buildingAddress: formatAddress(building),
    periodLabel: periodLabel(input.selection.from, input.selection.to),
    preparedBy: input.userName,
    preparedOn: formatDateTime(input.preparedAt),
    sections: input.sections,
    summary: summariseReport({
      cases: selected,
      from: input.selection.from,
      to: input.selection.to,
      visits,
      runs: inspections,
    }),
    cases: await casePages(input.buildingId, selected, input.sections),
    visits: visits.map((visit) => ({
      when: formatCalendarDate(visit.occursOn),
      subject: visit.subject,
      status: visitStatusLabel(visit.status),
    })),
    inspections: inspections.map(toPdfInspection),
  };
}

async function renderManagementReport(format: ReportFileFormat, report: ManagementReportPdfInput): Promise<Uint8Array> {
  if (format === "pdf") return buildManagementPdf(report);
  if (format === "docx") return buildManagementDocx(report);
  return buildManagementXlsx({ cases: report.cases, visits: report.visits });
}

type Candidate = ReportCase & {
  completedAt: Date | null;
  companyNames: string[];
  subject: string;
};

async function loadCandidates(buildingId: string): Promise<Candidate[]> {
  const rows = await prisma.case.findMany({
    where: { buildingId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      startDate: true,
      completedAt: true,
      subject: true,
      typeId: true,
      status: true,
      priority: true,
      includeInReport: true,
      apartmentId: true,
      type: { select: { name: true } },
      companies: { select: { companyId: true, company: { select: { name: true } } } },
      assets: { select: { assetId: true } },
    },
  });
  return rows.map((row) => {
    const companies = [...row.companies].sort((a, b) => a.company.name.localeCompare(b.company.name, "en"));
    return {
      id: row.id,
      number: row.number,
      startDate: row.startDate,
      completedAt: row.completedAt,
      subject: row.subject,
      typeId: row.typeId,
      typeName: row.type.name,
      status: row.status,
      priority: row.priority,
      includeInReport: row.includeInReport,
      companyIds: companies.map((item) => item.companyId),
      companyNames: companies.map((item) => item.company.name),
      assetIds: row.assets.map((item) => item.assetId),
      apartmentId: row.apartmentId,
    };
  });
}

function toCatalogCase(item: Candidate): CatalogCase {
  return {
    id: item.id,
    number: item.number,
    startDate: formatIsoDate(item.startDate),
    completedLabel: item.completedAt ? formatCalendarDate(item.completedAt) : "",
    subject: item.subject,
    typeId: item.typeId,
    typeName: item.typeName,
    status: item.status,
    priority: item.priority,
    includeInReport: item.includeInReport,
    companyIds: item.companyIds,
    companyNames: item.companyNames,
    assetIds: item.assetIds,
    apartmentId: item.apartmentId,
  };
}

async function casePages(buildingId: string, selected: Candidate[], sections: ReportSections): Promise<ReportPdfCase[]> {
  if (!sections.details || selected.length === 0) {
    return selected.map((item) => lightCase(item));
  }
  const rows = await prisma.case.findMany({
    where: { buildingId, id: { in: selected.map((item) => item.id) } },
    select: {
      id: true,
      number: true,
      subject: true,
      descriptionHtml: true,
      internalNotes: true,
      area: true,
      startDate: true,
      completedAt: true,
      status: true,
      priority: true,
      type: { select: { name: true } },
      apartment: { select: { number: true } },
      assets: { select: { asset: { select: { name: true } } } },
      companies: { select: { company: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "asc" }, select: { kind: true, summary: true, createdAt: true } },
      workOrders: { orderBy: { sentAt: "asc" }, select: { suffix: true, companyName: true, status: true } },
      files: { select: { kind: true, name: true, storedName: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pages: ReportPdfCase[] = [];
  for (const item of selected) {
    const row = byId.get(item.id);
    if (!row) {
      pages.push(lightCase(item));
      continue;
    }
    const companies = [...row.companies].map((entry) => entry.company.name).sort((a, b) => a.localeCompare(b, "en"));
    const assets = [...row.assets].map((entry) => entry.asset.name).sort((a, b) => a.localeCompare(b, "en"));
    const photos = sections.photos ? await casePhotos(row.files) : [];
    pages.push({
      number: row.number,
      subject: row.subject,
      typeName: row.type.name,
      status: formatStatus(row.status),
      priority: formatPriority(row.priority),
      started: formatCalendarDate(row.startDate),
      completed: row.completedAt ? formatCalendarDate(row.completedAt) : "-",
      contractor: contractorLabel(companies),
      description: htmlToPlain(row.descriptionHtml),
      history: row.activities
        .filter((activity) => activity.kind === "created" || activity.kind === "status_changed")
        .map((activity) => `${formatDateTime(activity.createdAt)} - ${activity.summary}`),
      jobArea: jobAreaText(row.area, row.apartment?.number ?? null, assets),
      photos,
      quotes: sections.quotes ? namesOf(row.files, "quote") : [],
      invoices: sections.invoices ? namesOf(row.files, "invoice") : [],
      documents: sections.documents ? namesOf(row.files, "document") : [],
      notes: sections.notes ? htmlToPlain(row.internalNotes ?? "") : null,
      workOrders: row.workOrders.map(
        (order) => `${workOrderNumber(row.number, order.suffix)} - ${order.companyName} - ${formatWorkOrderStatus(order.status)}`,
      ),
    });
  }
  return pages;
}

function lightCase(item: Candidate): ReportPdfCase {
  return {
    number: item.number,
    subject: item.subject,
    typeName: item.typeName,
    status: formatStatus(item.status),
    priority: formatPriority(item.priority),
    started: formatCalendarDate(item.startDate),
    completed: item.completedAt ? formatCalendarDate(item.completedAt) : "-",
    contractor: contractorLabel(item.companyNames),
    description: "",
    history: [],
    jobArea: formatArea("none"),
    photos: [],
    quotes: [],
    invoices: [],
    documents: [],
    notes: null,
    workOrders: [],
  };
}

async function casePhotos(
  files: { kind: string; name: string; storedName: string }[],
): Promise<ReportPdfCase["photos"]> {
  const photos: ReportPdfCase["photos"] = [];
  for (const file of files) {
    if (photos.length >= PHOTO_LIMIT || file.kind !== "photo") continue;
    const kind = imageKind(file.storedName);
    if (!kind) continue;
    const bytes = await readStoredFile(file.storedName);
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > PHOTO_BYTES) continue;
    photos.push({ name: file.name, bytes: new Uint8Array(bytes), kind });
  }
  return photos;
}

function namesOf(files: { kind: string; name: string }[], kind: string): string[] {
  return files.filter((file) => file.kind === kind).map((file) => file.name);
}

function imageKind(storedName: string): "png" | "jpg" | null {
  const name = storedName.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  return null;
}

function jobAreaText(area: string, apartmentNumber: string | null, assetNames: string[]): string {
  if (area === "apartment") return apartmentNumber ? `Apartment ${apartmentNumber}` : "Apartment";
  if (area === "asset") return assetNames.length ? assetNames.join(", ") : "Asset";
  return "Not applicable";
}

function contractorLabel(names: string[]): string {
  return names.length ? names.join(", ") : "None";
}

async function loadInspectionRuns(buildingId: string) {
  const runs = await prisma.inspectionRun.findMany({
    where: { buildingId, status: "completed" },
    select: {
      name: true,
      status: true,
      completedAt: true,
      areas: {
        orderBy: { position: "asc" },
        select: {
          name: true,
          items: { orderBy: { position: "asc" }, select: { name: true, result: true, comment: true } },
        },
      },
    },
  });
  return runs.map((run) => ({
    name: run.name,
    status: run.status,
    completedAt: run.completedAt,
    items: run.areas.flatMap((area) =>
      area.items.map((item) => ({
        area: area.name,
        name: item.name,
        result: item.result,
        comment: item.comment,
      })),
    ),
  }));
}

function toPdfInspection(run: Awaited<ReturnType<typeof loadInspectionRuns>>[number]): ReportPdfInspection {
  const counts = resultCounts(run.items);
  return {
    name: run.name,
    completed: run.completedAt ? formatSydneyDate(run.completedAt) : "",
    pass: counts.pass,
    fail: counts.fail,
    na: counts.na,
    unanswered: counts.unanswered,
    failed: run.items
      .filter((item) => item.result === "fail")
      .map((item) => ({ area: item.area, item: item.name, comment: item.comment })),
  };
}
