import type { Prisma } from "@prisma/client";
import { caseTextWhere } from "./cases";
import { canManageInspectionTemplates } from "./roles";

export const QUICK_PER_GROUP = 5;
export const PAGE_PER_GROUP = 20;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;

export const SEARCH_GROUP_ORDER = [
  "case",
  "work_order",
  "resident",
  "apartment",
  "contractor",
  "asset",
  "inspection",
] as const;

export type SearchKind = (typeof SEARCH_GROUP_ORDER)[number];

export type SearchHit = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type SearchGroup = {
  kind: SearchKind;
  label: string;
  total: number;
  hits: SearchHit[];
};

export type SearchResults = {
  query: string;
  groups: SearchGroup[];
};

const LABELS: Record<SearchKind, string> = {
  case: "Cases",
  work_order: "Work orders",
  resident: "Residents",
  apartment: "Apartments",
  contractor: "Contractors",
  asset: "Assets",
  inspection: "Inspections",
};

const WORK_ORDER_NUMBER = /^([1-9]\d{0,8})-([A-Za-z]+)$/;

export function searchGroupLabel(kind: SearchKind): string {
  return LABELS[kind];
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_LENGTH);
}

export function isSearchable(query: string): boolean {
  return normalizeSearchQuery(query).length >= SEARCH_MIN_LENGTH;
}

export function resultsHref(query: string): string {
  return `/search?q=${encodeURIComponent(normalizeSearchQuery(query))}`;
}

export type SearchPlan = {
  building: boolean;
  templates: boolean;
};

export function searchPlan(role: string, buildingId: string | null): SearchPlan {
  const building = Boolean(buildingId);
  return {
    building,
    templates: building && canManageInspectionTemplates(role),
  };
}

export function orderedGroups(groups: SearchGroup[]): SearchGroup[] {
  const byKind = new Map(groups.map((group) => [group.kind, group]));
  return SEARCH_GROUP_ORDER.flatMap((kind) => {
    const group = byKind.get(kind);
    return group && group.hits.length > 0 ? [group] : [];
  });
}

function exactCaseNumber(value: string): number | null {
  if (!/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

export function caseSearchWhere(buildingId: string, query: string): Prisma.CaseWhereInput {
  const q = normalizeSearchQuery(query);
  return { AND: [{ buildingId }, { OR: caseTextWhere(buildingId, q) }] };
}

export function workOrderSearchWhere(buildingId: string, query: string): Prisma.WorkOrderWhereInput {
  const q = normalizeSearchQuery(query);
  const or: Prisma.WorkOrderWhereInput[] = [
    { subject: { contains: q } },
    { companyName: { contains: q } },
    { company: { name: { contains: q } } },
  ];
  const lettered = q.match(WORK_ORDER_NUMBER);
  if (lettered) {
    or.push({ case: { number: Number(lettered[1]) }, suffix: lettered[2].toUpperCase() });
  } else {
    const number = exactCaseNumber(q);
    if (number) or.push({ case: { number } });
  }
  return { AND: [{ case: { buildingId } }, { OR: or }] };
}

export function residentSearchWhere(buildingId: string, query: string): Prisma.ResidentWhereInput {
  const tokens = normalizeSearchQuery(query).split(" ").filter(Boolean);
  return {
    AND: [
      { apartment: { buildingId } },
      ...tokens.map((token) => ({
        OR: [
          { firstName: { contains: token } },
          { lastName: { contains: token } },
          { email: { contains: token } },
          { phone: { contains: token } },
          { mobile: { contains: token } },
          { secondaryPhone: { contains: token } },
          { apartment: { number: { contains: token } } },
          { apartment: { lotNumber: { contains: token } } },
        ],
      })),
    ],
  };
}

export function apartmentSearchWhere(buildingId: string, query: string): Prisma.ApartmentWhereInput {
  const q = normalizeSearchQuery(query);
  return {
    AND: [{ buildingId }, { OR: [{ number: { contains: q } }, { lotNumber: { contains: q } }] }],
  };
}

export function contractorSearchWhere(query: string): Prisma.ContractorCompanyWhereInput {
  const q = normalizeSearchQuery(query);
  return {
    OR: [{ name: { contains: q } }, { category: { name: { contains: q } } }],
  };
}

export function assetSearchWhere(buildingId: string, query: string): Prisma.AssetWhereInput {
  const q = normalizeSearchQuery(query);
  return {
    AND: [
      { buildingId },
      {
        OR: [
          { name: { contains: q } },
          { location: { contains: q } },
          { serialNumber: { contains: q } },
          { make: { contains: q } },
          { model: { contains: q } },
          { category: { name: { contains: q } } },
        ],
      },
    ],
  };
}

export function inspectionRunSearchWhere(buildingId: string, query: string): Prisma.InspectionRunWhereInput {
  const q = normalizeSearchQuery(query);
  return {
    AND: [
      { buildingId },
      { OR: [{ name: { contains: q } }, { apartment: { number: { contains: q } } }] },
    ],
  };
}

export function inspectionTemplateSearchWhere(buildingId: string, query: string): Prisma.InspectionTemplateWhereInput {
  const q = normalizeSearchQuery(query);
  return {
    AND: [{ buildingId }, { OR: [{ name: { contains: q } }, { description: { contains: q } }] }],
  };
}
