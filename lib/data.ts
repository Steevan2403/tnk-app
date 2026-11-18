import { cache } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth, signOut } from "@/auth";
import type { BuildingRecord } from "@/lib/buildings";
import {
  PAGE_SIZE,
  expiredInsuranceWhere,
  insuranceStanding,
  type ContractorTab,
  type InsuranceStanding,
} from "@/lib/contractors";
import {
  PAGE_SIZE as RESIDENT_PAGE_SIZE,
  compareLabel,
  parseResidentType,
  type ResidentType,
} from "@/lib/residents";
import { PAGE_SIZE as ASSET_PAGE_SIZE, latestWarrantyExpiry } from "@/lib/assets";
import { prisma } from "@/lib/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  selectedBuildingId: string | null;
};

const buildingSelect = {
  id: true,
  name: true,
  address: true,
  suburb: true,
  state: true,
  postcode: true,
  photoUrl: true,
  lotCount: true,
} as const;

export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      selectedBuildingId: true,
    },
  });

  if (!user) {
    await signOut({ redirectTo: "/sign-in" });
    redirect("/sign-in");
  }

  return user;
});

export const listBuildings = cache(async (): Promise<BuildingRecord[]> => {
  return prisma.building.findMany({
    orderBy: { name: "asc" },
    select: buildingSelect,
  });
});

export const getBuilding = cache(async (id: string): Promise<BuildingRecord | null> => {
  return prisma.building.findUnique({
    where: { id },
    select: buildingSelect,
  });
});

export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  companyId: string;
  companyName: string;
  categoryName: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  categoryName: string;
  contactCount: number;
  status: "pending" | "approved";
  insurance: InsuranceStanding;
};

export type ContractorListQuery = {
  tab: ContractorTab;
  q: string;
  companyId: string;
  categoryId: string;
  page: number;
};

export type ContractorListResult =
  | { kind: "contacts"; total: number; rows: ContactRow[] }
  | { kind: "companies"; total: number; rows: CompanyRow[] };

const companyListInclude = {
  category: { select: { name: true } },
  _count: { select: { contacts: true } },
  insurances: { select: { expiresOn: true } },
} as const;

export const listContractorCategories = cache(async () => {
  return prisma.contractorCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
});

export const listContractorCompanyOptions = cache(async () => {
  return prisma.contractorCompany.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
});

export async function listContractors(query: ContractorListQuery): Promise<ContractorListResult> {
  const skip = (query.page - 1) * PAGE_SIZE;
  if (query.tab === "contacts") {
    const where = contactWhere(query);
    const [total, contacts] = await Promise.all([
      prisma.contractorContact.count({ where }),
      prisma.contractorContact.findMany({
        where,
        orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
        skip,
        take: PAGE_SIZE,
        include: { company: { include: { category: { select: { name: true } } } } },
      }),
    ]);
    return {
      kind: "contacts",
      total,
      rows: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        mobile: contact.mobile,
        email: contact.email,
        companyId: contact.companyId,
        companyName: contact.company.name,
        categoryName: contact.company.category.name,
      })),
    };
  }

  const where = companyWhere(query);
  const [total, companies] = await Promise.all([
    prisma.contractorCompany.count({ where }),
    prisma.contractorCompany.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: PAGE_SIZE,
      include: companyListInclude,
    }),
  ]);

  return {
    kind: "companies",
    total,
    rows: companies.map((company) => ({
      id: company.id,
      name: company.name,
      phone: company.phone,
      email: company.email,
      categoryName: company.category.name,
      contactCount: company._count.contacts,
      status: company.status,
      insurance: insuranceStanding(company.insurances.map((insurance) => insurance.expiresOn)),
    })),
  };
}

function companyWhere(query: ContractorListQuery): Prisma.ContractorCompanyWhereInput {
  const filters: Prisma.ContractorCompanyWhereInput[] = [];
  if (query.companyId) filters.push({ id: query.companyId });
  if (query.categoryId) filters.push({ categoryId: query.categoryId });
  if (query.q) {
    filters.push({
      OR: [
        { name: { contains: query.q } },
        { email: { contains: query.q } },
        { contacts: { some: { name: { contains: query.q } } } },
        { contacts: { some: { email: { contains: query.q } } } },
      ],
    });
  }
  if (query.tab === "expired") filters.push(expiredInsuranceWhere());
  if (query.tab === "pending") filters.push({ status: "pending" });
  return filters.length > 0 ? { AND: filters } : {};
}

function contactWhere(query: ContractorListQuery): Prisma.ContractorContactWhereInput {
  const filters: Prisma.ContractorContactWhereInput[] = [];
  if (query.companyId) filters.push({ companyId: query.companyId });
  if (query.categoryId) filters.push({ company: { categoryId: query.categoryId } });
  if (query.q) {
    filters.push({
      OR: [
        { name: { contains: query.q } },
        { email: { contains: query.q } },
        { company: { name: { contains: query.q } } },
        { company: { email: { contains: query.q } } },
      ],
    });
  }
  return filters.length > 0 ? { AND: filters } : {};
}

const companyDetailInclude = {
  category: true,
  contacts: { orderBy: { name: "asc" as const } },
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { name: true } } },
  },
  documents: { orderBy: { uploadedAt: "desc" as const } },
  insurances: { orderBy: { expiresOn: "asc" as const } },
} satisfies Prisma.ContractorCompanyInclude;

export type ContractorCompanyDetail = Prisma.ContractorCompanyGetPayload<{
  include: typeof companyDetailInclude;
}>;

export const getContractorCompany = cache(async (id: string): Promise<ContractorCompanyDetail | null> => {
  return prisma.contractorCompany.findUnique({
    where: { id },
    include: companyDetailInclude,
  });
});

export type ResidentRow = {
  id: string;
  firstName: string;
  lastName: string;
  type: ResidentType;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  primaryContact: boolean;
  apartmentId: string;
  apartmentNumber: string;
  lotNumber: string;
};

export type ApartmentRow = {
  id: string;
  number: string;
  lotNumber: string;
  occupancy: "owner_occupied" | "investment";
  residentCount: number;
};

export type ResidentListQuery = {
  buildingId: string;
  q: string;
  type: string;
  page: number;
};

export async function listResidents(query: ResidentListQuery): Promise<{ total: number; rows: ResidentRow[] }> {
  const where = residentWhere(query);
  const skip = (query.page - 1) * RESIDENT_PAGE_SIZE;
  const [total, residents] = await Promise.all([
    prisma.resident.count({ where }),
    prisma.resident.findMany({
      where,
      skip,
      take: RESIDENT_PAGE_SIZE,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { apartment: { select: { id: true, number: true, lotNumber: true } } },
    }),
  ]);

  return {
    total,
    rows: residents.map((resident) => ({
      id: resident.id,
      firstName: resident.firstName,
      lastName: resident.lastName,
      type: resident.type,
      phone: resident.phone,
      mobile: resident.mobile,
      email: resident.email,
      primaryContact: resident.primaryContact,
      apartmentId: resident.apartment.id,
      apartmentNumber: resident.apartment.number,
      lotNumber: resident.apartment.lotNumber,
    })),
  };
}

export async function listApartments(buildingId: string): Promise<ApartmentRow[]> {
  const apartments = await prisma.apartment.findMany({
    where: { buildingId },
    include: { _count: { select: { residents: true } } },
  });

  return apartments
    .map((apartment) => ({
      id: apartment.id,
      number: apartment.number,
      lotNumber: apartment.lotNumber,
      occupancy: apartment.occupancy,
      residentCount: apartment._count.residents,
    }))
    .sort((a, b) => compareLabel(a.number, b.number) || compareLabel(a.lotNumber, b.lotNumber));
}

export const listApartmentOptions = cache(async (buildingId: string) => {
  const apartments = await prisma.apartment.findMany({
    where: { buildingId },
    select: { id: true, number: true, lotNumber: true },
  });
  return apartments.sort((a, b) => compareLabel(a.number, b.number));
});

const apartmentDetailInclude = {
  residents: { orderBy: [{ lastName: "asc" as const }, { firstName: "asc" as const }] },
  vehicles: { orderBy: { registration: "asc" as const } },
  documents: { orderBy: { uploadedAt: "desc" as const } },
  images: { orderBy: { uploadedAt: "desc" as const } },
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { name: true } } },
  },
  owners: { orderBy: { name: "asc" as const } },
  agent: true,
} satisfies Prisma.ApartmentInclude;

export type ApartmentDetail = Prisma.ApartmentGetPayload<{ include: typeof apartmentDetailInclude }>;

export async function getApartment(buildingId: string, id: string): Promise<ApartmentDetail | null> {
  return prisma.apartment.findFirst({
    where: { id, buildingId },
    include: apartmentDetailInclude,
  });
}

const residentFormSelect = {
  id: true,
  apartmentId: true,
  firstName: true,
  lastName: true,
  type: true,
  phone: true,
  mobile: true,
  secondaryPhone: true,
  email: true,
  moveInOn: true,
  moveOutOn: true,
  primaryContact: true,
  notes: true,
} as const;

export type ResidentFormRecord = Prisma.ResidentGetPayload<{ select: typeof residentFormSelect }>;

export async function getResident(buildingId: string, id: string): Promise<ResidentFormRecord | null> {
  return prisma.resident.findFirst({
    where: { id, apartment: { buildingId } },
    select: residentFormSelect,
  });
}

export type AssetRow = {
  id: string;
  name: string;
  categoryName: string;
  location: string | null;
  serialNumber: string | null;
  make: string | null;
  model: string | null;
  assetValue: string | null;
  companyName: string | null;
  purchasedOn: Date;
  warrantyExpiresOn: Date | null;
};

export type AssetListQuery = {
  buildingId: string;
  q: string;
  categoryId: string;
  page: number;
};

export async function listAssets(query: AssetListQuery): Promise<{ total: number; rows: AssetRow[] }> {
  const where = assetWhere(query);
  const skip = (query.page - 1) * ASSET_PAGE_SIZE;
  const [total, assets] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      skip,
      take: ASSET_PAGE_SIZE,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        category: { select: { name: true } },
        company: { select: { name: true } },
        warranties: { select: { expiresOn: true } },
      },
    }),
  ]);

  return {
    total,
    rows: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      categoryName: asset.category.name,
      location: asset.location,
      serialNumber: asset.serialNumber,
      make: asset.make,
      model: asset.model,
      assetValue: asset.assetValue?.toFixed(2) ?? null,
      companyName: asset.company?.name ?? null,
      purchasedOn: asset.purchasedOn,
      warrantyExpiresOn: latestWarrantyExpiry(asset.warranties.map((warranty) => warranty.expiresOn)),
    })),
  };
}

export const listAssetCategories = cache(async () => {
  return prisma.assetCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { assets: true } } },
  });
});

export async function listServiceCompanies(includeCompanyId?: string | null) {
  return prisma.contractorCompany.findMany({
    where: includeCompanyId
      ? { OR: [{ status: "approved" }, { id: includeCompanyId }] }
      : { status: "approved" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contacts: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true },
      },
    },
  });
}

const assetDetailInclude = {
  category: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  building: { select: { id: true, name: true } },
  photos: { orderBy: { uploadedAt: "desc" as const } },
  documents: { orderBy: { uploadedAt: "desc" as const } },
  warranties: { orderBy: [{ expiresOn: "desc" as const }, { provider: "asc" as const }] },
} satisfies Prisma.AssetInclude;

export type AssetDetail = Prisma.AssetGetPayload<{ include: typeof assetDetailInclude }>;

export async function getAsset(buildingId: string, id: string): Promise<AssetDetail | null> {
  return prisma.asset.findFirst({
    where: { id, buildingId },
    include: assetDetailInclude,
  });
}

function assetWhere(query: AssetListQuery): Prisma.AssetWhereInput {
  const filters: Prisma.AssetWhereInput[] = [{ buildingId: query.buildingId }];
  if (query.categoryId) filters.push({ categoryId: query.categoryId });
  if (query.q) {
    filters.push({
      OR: [
        { name: { contains: query.q } },
        { serialNumber: { contains: query.q } },
        { make: { contains: query.q } },
        { model: { contains: query.q } },
        { location: { contains: query.q } },
        { barcode: { contains: query.q } },
      ],
    });
  }
  return { AND: filters };
}

function residentWhere(query: ResidentListQuery): Prisma.ResidentWhereInput {
  const filters: Prisma.ResidentWhereInput[] = [{ apartment: { buildingId: query.buildingId } }];
  const type = parseResidentType(query.type);
  if (type) filters.push({ type });
  const tokens = query.q.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    filters.push({
      OR: [
        { firstName: { contains: token } },
        { lastName: { contains: token } },
        { email: { contains: token } },
        { phone: { contains: token } },
        { mobile: { contains: token } },
        { secondaryPhone: { contains: token } },
        { apartment: { number: { contains: token } } },
      ],
    });
  }
  return { AND: filters };
}
