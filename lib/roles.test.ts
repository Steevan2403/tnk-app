import { describe, expect, it } from "vitest";
import { canManageBuildings, canManageContractors } from "./roles";

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
