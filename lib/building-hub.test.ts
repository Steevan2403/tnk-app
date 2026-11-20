import { describe, expect, it } from "vitest";
import { BUILDING_TILES, buildingNavIsCurrent, canOpenBuildingTile } from "./building-hub";

describe("canOpenBuildingTile", () => {
  it("lets admin, manager, and staff open every building section", () => {
    for (const role of ["admin", "manager", "staff"]) {
      for (const tile of BUILDING_TILES) {
        expect(canOpenBuildingTile(role, tile)).toBe(true);
      }
    }
  });

  it("hides every tile from a role that cannot open the sections", () => {
    for (const tile of BUILDING_TILES) {
      expect(canOpenBuildingTile("guest", tile)).toBe(false);
    }
  });
});

describe("buildingNavIsCurrent", () => {
  it("highlights Building on the hub and its section routes", () => {
    for (const pathname of [
      "/building",
      "/building/assets",
      "/building/assets/seed",
      "/building/inspections",
      "/building/inspections/runs/seed",
      "/building/reports",
      "/building/categories",
      "/maintenance",
      "/maintenance/new",
      "/residents",
      "/residents/apartments/seed",
      "/contractors",
      "/contractors/seed",
    ]) {
      expect(buildingNavIsCurrent(pathname)).toBe(true);
    }
  });

  it("leaves Building unselected on other routes, including manage buildings", () => {
    for (const pathname of ["/dashboard", "/cases", "/cases/300", "/work-orders", "/calendar", "/settings", "/buildings"]) {
      expect(buildingNavIsCurrent(pathname)).toBe(false);
    }
  });
});
