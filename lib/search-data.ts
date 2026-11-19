import { formatStatus } from "./cases";
import { prisma } from "./db";
import { formatOccupancy, formatResidentType, residentName } from "./residents";
import {
  apartmentSearchWhere,
  assetSearchWhere,
  caseSearchWhere,
  contractorSearchWhere,
  inspectionRunSearchWhere,
  inspectionTemplateSearchWhere,
  isSearchable,
  residentSearchWhere,
  normalizeSearchQuery,
  orderedGroups,
  searchGroupLabel,
  searchPlan,
  workOrderSearchWhere,
  type SearchGroup,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from "./search";
import { formatWorkOrderStatus, workOrderNumber } from "./work-orders";

export async function searchRecords(input: {
  buildingId: string | null;
  role: string;
  query: string;
  perGroup: number;
}): Promise<SearchResults> {
  const query = normalizeSearchQuery(input.query);
  if (!isSearchable(query)) return { query, groups: [] };

  const perGroup = Math.min(Math.max(Math.trunc(input.perGroup), 1), 50);
  const plan = searchPlan(input.role, input.buildingId);
  const buildingId = input.buildingId;

  const [cases, workOrders, residents, apartments, contractors, assets, runs, templates] = await Promise.all([
    plan.building && buildingId ? searchCases(buildingId, query, perGroup) : blank("case"),
    plan.building && buildingId ? searchWorkOrders(buildingId, query, perGroup) : blank("work_order"),
    plan.building && buildingId ? searchResidents(buildingId, query, perGroup) : blank("resident"),
    plan.building && buildingId ? searchApartments(buildingId, query, perGroup) : blank("apartment"),
    searchContractors(query, perGroup),
    plan.building && buildingId ? searchAssets(buildingId, query, perGroup) : blank("asset"),
    plan.building && buildingId ? searchRuns(buildingId, query, perGroup) : blank("inspection"),
    plan.templates && buildingId ? searchTemplates(buildingId, query, perGroup) : blank("inspection"),
  ]);

  return {
    query,
    groups: orderedGroups([cases, workOrders, residents, apartments, contractors, assets, mergeInspections(runs, templates, perGroup)]),
  };
}

function blank(kind: SearchKind): SearchGroup {
  return { kind, label: searchGroupLabel(kind), total: 0, hits: [] };
}

function line(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

function mergeInspections(runs: SearchGroup, templates: SearchGroup, perGroup: number): SearchGroup {
  const hits = [...templates.hits, ...runs.hits]
    .sort((a, b) => a.title.localeCompare(b.title, "en") || a.detail.localeCompare(b.detail, "en"))
    .slice(0, perGroup);
  return {
    kind: "inspection",
    label: searchGroupLabel("inspection"),
    total: runs.total + templates.total,
    hits,
  };
}

async function searchCases(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = caseSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({
      where,
      orderBy: { number: "desc" },
      take: perGroup,
      select: { id: true, number: true, subject: true, status: true, type: { select: { name: true } } },
    }),
  ]);
  return {
    kind: "case",
    label: searchGroupLabel("case"),
    total,
    hits: rows.map((row) => ({
      id: row.id,
      title: `${row.number} · ${row.subject}`,
      detail: line([row.type.name, formatStatus(row.status)]),
      href: `/cases/${row.number}`,
    })),
  };
}

async function searchWorkOrders(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = workOrderSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: perGroup,
      select: {
        id: true,
        suffix: true,
        companyName: true,
        status: true,
        case: { select: { number: true, subject: true } },
        company: { select: { name: true } },
      },
    }),
  ]);
  return {
    kind: "work_order",
    label: searchGroupLabel("work_order"),
    total,
    hits: rows.map((row) => ({
      id: row.id,
      title: workOrderNumber(row.case.number, row.suffix),
      detail: line([row.case.subject, row.company?.name ?? row.companyName, formatWorkOrderStatus(row.status)]),
      href: `/work-orders/${row.id}`,
    })),
  };
}

async function searchResidents(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = residentSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.resident.count({ where }),
    prisma.resident.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: perGroup,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        type: true,
        email: true,
        apartmentId: true,
        apartment: { select: { number: true } },
      },
    }),
  ]);
  return {
    kind: "resident",
    label: searchGroupLabel("resident"),
    total,
    hits: rows.map((row) => ({
      id: row.id,
      title: residentName(row.firstName, row.lastName),
      detail: line([`Apartment ${row.apartment.number}`, formatResidentType(row.type), row.email]),
      href: `/residents/apartments/${row.apartmentId}`,
    })),
  };
}

async function searchApartments(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = apartmentSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.apartment.count({ where }),
    prisma.apartment.findMany({
      where,
      orderBy: { number: "asc" },
      take: perGroup,
      select: { id: true, number: true, lotNumber: true, occupancy: true },
    }),
  ]);
  return {
    kind: "apartment",
    label: searchGroupLabel("apartment"),
    total,
    hits: rows.map((row) => ({
      id: row.id,
      title: `Apartment ${row.number}`,
      detail: line([row.lotNumber ? `Lot ${row.lotNumber}` : null, formatOccupancy(row.occupancy)]),
      href: `/residents/apartments/${row.id}`,
    })),
  };
}

async function searchContractors(query: string, perGroup: number): Promise<SearchGroup> {
  const where = contractorSearchWhere(query);
  const [total, rows] = await Promise.all([
    prisma.contractorCompany.count({ where }),
    prisma.contractorCompany.findMany({
      where,
      orderBy: { name: "asc" },
      take: perGroup,
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
  ]);
  return {
    kind: "contractor",
    label: searchGroupLabel("contractor"),
    total,
    hits: rows.map((row) => ({
      id: row.id,
      title: row.name,
      detail: row.category.name,
      href: `/contractors/${row.id}`,
    })),
  };
}

async function searchAssets(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = assetSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      orderBy: { name: "asc" },
      take: perGroup,
      select: { id: true, name: true, location: true, category: { select: { name: true } } },
    }),
  ]);
  return {
    kind: "asset",
    label: searchGroupLabel("asset"),
    total,
    hits: rows.map((row) => ({
      id: row.id,
      title: row.name,
      detail: line([row.category.name, row.location]),
      href: `/building/assets/${row.id}`,
    })),
  };
}

async function searchRuns(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = inspectionRunSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.inspectionRun.count({ where }),
    prisma.inspectionRun.findMany({
      where,
      orderBy: { name: "asc" },
      take: perGroup,
      select: { id: true, name: true, status: true, apartment: { select: { number: true } } },
    }),
  ]);
  return {
    kind: "inspection",
    label: searchGroupLabel("inspection"),
    total,
    hits: rows.map((row) => hitInspection(row.id, row.name, runDetail(row.status, row.apartment?.number ?? null), `/building/inspections/runs/${row.id}`)),
  };
}

async function searchTemplates(buildingId: string, query: string, perGroup: number): Promise<SearchGroup> {
  const where = inspectionTemplateSearchWhere(buildingId, query);
  const [total, rows] = await Promise.all([
    prisma.inspectionTemplate.count({ where }),
    prisma.inspectionTemplate.findMany({
      where,
      orderBy: { name: "asc" },
      take: perGroup,
      select: { id: true, name: true },
    }),
  ]);
  return {
    kind: "inspection",
    label: searchGroupLabel("inspection"),
    total,
    hits: rows.map((row) => hitInspection(row.id, row.name, "Template", `/building/inspections/templates/${row.id}`)),
  };
}

function runDetail(status: string, apartmentNumber: string | null): string {
  const label = status === "completed" ? "Completed" : "In progress";
  return line([label, apartmentNumber ? `Apartment ${apartmentNumber}` : null]);
}

function hitInspection(id: string, title: string, detail: string, href: string): SearchHit {
  return { id, title, detail, href };
}
