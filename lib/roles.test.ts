import { describe, expect, it } from "vitest";
import {
  canManageAssetCategories,
  canManageAssets,
  canManageBuildings,
  canManageContractors,
  canManageResidents,
} from "./roles";

describe("canManageBuildings", () => {
  it("allows an admin", () => {
    expect(canManageBuildings("admin")).toBe(true);
  });

  it("blocks manager and staff", () => {
    expect(canManageBuildings("manager")).toBe(false);
    expect(canManageBuildings("staff")).toBe(false);
  });
});

describe("canManageContractors", () => {
  it("allows an admin or a manager", () => {
    expect(canManageContractors("admin")).toBe(true);
    expect(canManageContractors("manager")).toBe(true);
  });

  it("blocks staff", () => {
    expect(canManageContractors("staff")).toBe(false);
  });
});

describe("canManageResidents", () => {
  it("allows an admin or a manager", () => {
    expect(canManageResidents("admin")).toBe(true);
    expect(canManageResidents("manager")).toBe(true);
  });

  it("blocks staff", () => {
    expect(canManageResidents("staff")).toBe(false);
  });
});

describe("canManageAssets", () => {
  it("allows an admin or a manager", () => {
    expect(canManageAssets("admin")).toBe(true);
    expect(canManageAssets("manager")).toBe(true);
  });

  it("blocks staff", () => {
    expect(canManageAssets("staff")).toBe(false);
  });
});

describe("canManageAssetCategories", () => {
  it("allows an admin", () => {
    expect(canManageAssetCategories("admin")).toBe(true);
  });

  it("blocks manager and staff", () => {
    expect(canManageAssetCategories("manager")).toBe(false);
    expect(canManageAssetCategories("staff")).toBe(false);
  });
});
