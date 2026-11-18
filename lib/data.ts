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
