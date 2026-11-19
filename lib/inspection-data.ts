import type { InspectionResult, InspectionType } from "@prisma/client";
import { formatAddress } from "./buildings";
import type { InspectionPdfInput } from "./inspection-pdf";
import { completedRange, formatSydneyDate } from "./inspections";
import { prisma } from "./db";
import { readStoredFile } from "./storage";

export type TemplateRow = {
  id: string;
  name: string;
  type: InspectionType;
  createdAt: Date;
  itemCount: number;
  completedRuns: number;
  activeRuns: number;
};

export type RunListRow = {
  id: string;
  name: string;
  type: InspectionType;
  inspectorName: string;
  apartmentNumber: string | null;
  startedAt: Date;
  inspectedAt: Date;
  completedAt: Date | null;
  pass: number;
  fail: number;
  na: number;
  answered: number;
  total: number;
};

const runInclude = {
  building: { select: { name: true, address: true, suburb: true, state: true, postcode: true } },
  apartment: { select: { id: true, number: true } },
  inspector: { select: { name: true } },
  areas: {
    orderBy: { position: "asc" as const },
    include: {
      items: {
        orderBy: { position: "asc" as const },
        include: {
          photos: { orderBy: { uploadedAt: "asc" as const }, select: { id: true, name: true, storedName: true } },
          linkedCase: { select: { number: true } },
        },
      },
    },
  },
};

export async function listTemplates(buildingId: string, query: { q: string; type: string }): Promise<TemplateRow[]> {
  const templates = await prisma.inspectionTemplate.findMany({
    where: {
      buildingId,
      ...(query.type === "common_area" || query.type === "private_lot" ? { type: query.type } : {}),
      ...(query.q ? { name: { contains: query.q } } : {}),
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    include: {
      areas: { select: { items: { select: { id: true } } } },
      runs: { select: { status: true } },
    },
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    createdAt: template.createdAt,
    itemCount: template.areas.reduce((sum, area) => sum + area.items.length, 0),
    completedRuns: template.runs.filter((run) => run.status === "completed").length,
    activeRuns: template.runs.filter((run) => run.status === "in_progress").length,
  }));
}

export async function listRuns(
  buildingId: string,
  query: {
    status: "in_progress" | "completed";
    q: string;
    type: string;
    from: Date | null;
    to: Date | null;
    openFails: boolean;
  },
): Promise<RunListRow[]> {
  const range = query.status === "completed" ? completedRange(query.from, query.to) : null;
  const runs = await prisma.inspectionRun.findMany({
    where: {
      buildingId,
      status: query.status,
      ...(query.type === "common_area" || query.type === "private_lot" ? { type: query.type } : {}),
      ...(query.q ? { name: { contains: query.q } } : {}),
      ...(range ? { completedAt: range } : {}),
      ...(query.openFails
        ? { areas: { some: { items: { some: { result: "fail", linkedCase: { is: null } } } } } }
        : {}),
    },
    orderBy: query.status === "completed" ? [{ completedAt: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    include: {
      inspector: { select: { name: true } },
      apartment: { select: { number: true } },
      areas: { select: { items: { select: { result: true } } } },
    },
  });

  return runs.map((run) => {
    const items = run.areas.flatMap((area) => area.items);
    const pass = items.filter((item) => item.result === "pass").length;
    const fail = items.filter((item) => item.result === "fail").length;
    const na = items.filter((item) => item.result === "na").length;
    return {
      id: run.id,
      name: run.name,
      type: run.type,
      inspectorName: run.inspector.name,
      apartmentNumber: run.apartment?.number ?? null,
      startedAt: run.createdAt,
      inspectedAt: run.inspectedAt,
      completedAt: run.completedAt,
      pass,
      fail,
      na,
      answered: pass + fail + na,
      total: items.length,
    };
  });
}

export async function templateRunCounts(buildingId: string, templateId: string) {
  const runs = await prisma.inspectionRun.findMany({
    where: { buildingId, templateId },
    select: { status: true },
  });
  return {
    completedRuns: runs.filter((run) => run.status === "completed").length,
    activeRuns: runs.filter((run) => run.status === "in_progress").length,
  };
}

export async function getTemplate(buildingId: string, id: string) {
  return prisma.inspectionTemplate.findFirst({
    where: { id, buildingId },
    include: {
      areas: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
}

export async function getRun(buildingId: string, id: string) {
  return prisma.inspectionRun.findFirst({
    where: { id, buildingId },
    include: runInclude,
  });
}

export type InspectionRunRecord = NonNullable<Awaited<ReturnType<typeof getRun>>>;

export async function listInspectionApartments(buildingId: string) {
  return prisma.apartment.findMany({
    where: { buildingId },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
}

export async function inspectionPdfInput(buildingId: string, id: string): Promise<InspectionPdfInput | null> {
  const run = await getRun(buildingId, id);
  if (!run || run.status !== "completed") return null;
  const areas = [];
  for (const area of run.areas) {
    const items = [];
    for (const item of area.items) {
      const photos = [];
      for (const photo of item.photos) {
        const bytes = await readStoredFile(photo.storedName);
        if (!bytes) continue;
        photos.push({ name: photo.name, storedName: photo.storedName, bytes });
      }
      items.push({
        name: item.name,
        result: item.result,
        comment: item.comment,
        caseNumber: item.linkedCase?.number ?? null,
        photos,
      });
    }
    areas.push({ name: area.name, items });
  }
  return {
    name: run.name,
    type: run.type,
    buildingName: run.building.name,
    buildingAddress: formatAddress(run.building),
    apartmentNumber: run.apartment?.number ?? null,
    inspectorName: run.inspector.name,
    inspectedAtLabel: formatSydneyDate(run.inspectedAt),
    completedAtLabel: run.completedAt ? formatSydneyDate(run.completedAt) : null,
    areas,
  };
}

export function flatItems(run: InspectionRunRecord): {
  id: string;
  name: string;
  areaName: string;
  result: InspectionResult | null;
  comment: string | null;
  caseId: string | null;
  caseNumber: number | null;
  photos: { name: string; storedName: string }[];
}[] {
  return run.areas.flatMap((area) =>
    area.items.map((item) => ({
      id: item.id,
      name: item.name,
      areaName: area.name,
      result: item.result,
      comment: item.comment,
      caseId: item.linkedCase ? String(item.linkedCase.number) : null,
      caseNumber: item.linkedCase?.number ?? null,
      photos: item.photos.map((photo) => ({ name: photo.name, storedName: photo.storedName })),
    })),
  );
}
