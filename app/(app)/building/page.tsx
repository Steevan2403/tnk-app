import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  HardHat,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { canOpenBuildingTile, type BuildingTileId } from "@/lib/building-hub";
import { formatAddress } from "@/lib/buildings";
import { listBuildings, requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Building" };

export default async function BuildingPage() {
  const user = await requireUser();
  const buildings = await listBuildings();
  const building = buildings.find((item) => item.id === user.selectedBuildingId) ?? null;

  if (!building) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Building</h1>
        <p className="mt-4 text-muted">Select a building to see its sections.</p>
      </section>
    );
  }

  const counts = await sectionCounts(building.id);
  const tiles = TILES.filter((tile) => canOpenBuildingTile(user.role, tile.id));

  return (
    <section>
      <h1 className="font-serif text-3xl">Building</h1>
      <p className="mt-2 text-muted">
        {building.name}
        <span className="mx-2">·</span>
        {formatAddress(building)}
      </p>
      <section aria-label="Building sections" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.id}
              href={tile.href}
              className="flex h-full flex-col rounded-xl border border-line bg-card p-5 hover:border-brand-blue"
            >
              <Icon className="size-5 text-brand-blue" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-brand-navy">{tile.label}</h2>
              <p className="mt-2 text-sm font-medium text-ink">{tile.count(counts)}</p>
              <p className="mt-2 text-sm text-muted">{tile.description}</p>
            </Link>
          );
        })}
      </section>
    </section>
  );
}

type Counts = {
  assets: number;
  templates: number;
  schedules: number;
  reports: number;
  residents: number;
  apartments: number;
  companies: number;
  contractorCategories: number;
  assetCategories: number;
  caseTypes: number;
};

const TILES: {
  id: BuildingTileId;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  count: (counts: Counts) => string;
}[] = [
  {
    id: "assets",
    href: "/building/assets",
    label: "Assets",
    description: "Equipment and plant registered at this building.",
    icon: Boxes,
    count: (counts) => counted(counts.assets, "asset"),
  },
  {
    id: "inspections",
    href: "/building/inspections",
    label: "Inspections",
    description: "Checklists and the inspections run from them.",
    icon: ClipboardCheck,
    count: (counts) => counted(counts.templates, "template"),
  },
  {
    id: "maintenance",
    href: "/maintenance",
    label: "Maintenance",
    description: "Recurring jobs and one-off visits scheduled here.",
    icon: Wrench,
    count: (counts) => counted(counts.schedules, "schedule"),
  },
  {
    id: "reports",
    href: "/building/reports",
    label: "Management reports",
    description: "Period reports of the work at this building.",
    icon: BarChart3,
    count: (counts) => counted(counts.reports, "report"),
  },
  {
    id: "residents",
    href: "/residents",
    label: "Residents and apartments",
    description: "People who live here and the apartments they belong to.",
    icon: Users,
    count: (counts) => `${counted(counts.residents, "resident")} · ${counted(counts.apartments, "apartment")}`,
  },
  {
    id: "contractors",
    href: "/contractors",
    label: "Contractors",
    description: "Companies and contacts used for work on the account.",
    icon: HardHat,
    count: (counts) => counted(counts.companies, "company", "companies"),
  },
  {
    id: "categories",
    href: "/building/categories",
    label: "Categories",
    description: "Contractor categories, asset categories, and case types.",
    icon: Tags,
    count: (counts) =>
      `${counted(counts.contractorCategories, "contractor category", "contractor categories")} · ${counted(counts.assetCategories, "asset category", "asset categories")} · ${counted(counts.caseTypes, "case type")}`,
  },
];

async function sectionCounts(buildingId: string): Promise<Counts> {
  const [
    assets,
    templates,
    schedules,
    reports,
    residents,
    apartments,
    companies,
    contractorCategories,
    assetCategories,
    caseTypes,
  ] = await Promise.all([
    prisma.asset.count({ where: { buildingId } }),
    prisma.inspectionTemplate.count({ where: { buildingId } }),
    prisma.maintenanceEvent.count({ where: { buildingId } }),
    prisma.generatedReport.count({ where: { buildingId } }),
    prisma.resident.count({ where: { apartment: { buildingId } } }),
    prisma.apartment.count({ where: { buildingId } }),
    prisma.contractorCompany.count(),
    prisma.contractorCategory.count(),
    prisma.assetCategory.count(),
    prisma.caseType.count(),
  ]);
  return {
    assets,
    templates,
    schedules,
    reports,
    residents,
    apartments,
    companies,
    contractorCategories,
    assetCategories,
    caseTypes,
  };
}

function counted(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
