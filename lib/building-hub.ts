import { canRunInspections } from "./roles";

export const BUILDING_TILES = [
  "assets",
  "inspections",
  "maintenance",
  "reports",
  "residents",
  "contractors",
  "categories",
] as const;

export type BuildingTileId = (typeof BUILDING_TILES)[number];

export function canOpenBuildingTile(role: string, tile: BuildingTileId): boolean {
  if (tile === "inspections") return canRunInspections(role);
  return role === "admin" || role === "manager" || role === "staff";
}

export function buildingNavIsCurrent(pathname: string): boolean {
  if (pathname === "/building" || pathname.startsWith("/building/")) return true;
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) return true;
  if (pathname === "/residents" || pathname.startsWith("/residents/")) return true;
  if (pathname === "/contractors" || pathname.startsWith("/contractors/")) return true;
  return false;
}
