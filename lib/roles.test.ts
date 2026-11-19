import { describe, expect, it } from "vitest";
import {
  canDeleteCases,
  canEditCases,
  canManageAssetCategories,
  canManageAssets,
  canAssignBuildings,
  canManageBuildings,
  canCancelWorkOrders,
  canManageCaseTypes,
  canManageContractors,
  canManageResidents,
  canManageInspectionTemplates,
  canManageMaintenance,
  canRecordOccurrence,
  canManageReports,
  canRunInspections,
  canEditWorkOrderTerms,
  canSendWorkOrders,
  canViewOutbox,
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

describe("canAssignBuildings", () => {
  it("allows an admin to assign buildings", () => {
    expect(canAssignBuildings("admin")).toBe(true);
  });

  it("blocks manager and staff from assigning buildings", () => {
    expect(canAssignBuildings("manager")).toBe(false);
    expect(canAssignBuildings("staff")).toBe(false);
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

describe("case permissions", () => {
  it("lets admin, manager, and staff create and edit cases", () => {
    expect(canEditCases("admin")).toBe(true);
    expect(canEditCases("manager")).toBe(true);
    expect(canEditCases("staff")).toBe(true);
  });

  it("lets an admin or a manager delete cases", () => {
    expect(canDeleteCases("admin")).toBe(true);
    expect(canDeleteCases("manager")).toBe(true);
    expect(canDeleteCases("staff")).toBe(false);
  });

  it("lets only an admin manage case types", () => {
    expect(canManageCaseTypes("admin")).toBe(true);
    expect(canManageCaseTypes("manager")).toBe(false);
    expect(canManageCaseTypes("staff")).toBe(false);
  });
});

describe("work order permissions", () => {
  it("lets admin, manager, and staff send work orders", () => {
    expect(canSendWorkOrders("admin")).toBe(true);
    expect(canSendWorkOrders("manager")).toBe(true);
    expect(canSendWorkOrders("staff")).toBe(true);
  });

  it("lets an admin or a manager cancel a work order", () => {
    expect(canCancelWorkOrders("admin")).toBe(true);
    expect(canCancelWorkOrders("manager")).toBe(true);
    expect(canCancelWorkOrders("staff")).toBe(false);
  });

  it("lets an admin or a manager edit work order terms", () => {
    expect(canEditWorkOrderTerms("admin")).toBe(true);
    expect(canEditWorkOrderTerms("manager")).toBe(true);
    expect(canEditWorkOrderTerms("staff")).toBe(false);
  });

  it("lets only an admin view the outbox", () => {
    expect(canViewOutbox("admin")).toBe(true);
    expect(canViewOutbox("manager")).toBe(false);
    expect(canViewOutbox("staff")).toBe(false);
  });
});

describe("maintenance permissions", () => {
  it("lets an admin or a manager manage the schedule", () => {
    expect(canManageMaintenance("admin")).toBe(true);
    expect(canManageMaintenance("manager")).toBe(true);
    expect(canManageMaintenance("staff")).toBe(false);
  });

  it("lets admin, manager, and staff record an occurrence", () => {
    expect(canRecordOccurrence("admin")).toBe(true);
    expect(canRecordOccurrence("manager")).toBe(true);
    expect(canRecordOccurrence("staff")).toBe(true);
  });
});

describe("inspection permissions", () => {
  it("lets an admin or a manager edit templates", () => {
    expect(canManageInspectionTemplates("admin")).toBe(true);
    expect(canManageInspectionTemplates("manager")).toBe(true);
    expect(canManageInspectionTemplates("staff")).toBe(false);
  });

  it("lets admin, manager, and staff run an inspection", () => {
    expect(canRunInspections("admin")).toBe(true);
    expect(canRunInspections("manager")).toBe(true);
    expect(canRunInspections("staff")).toBe(true);
  });
});

describe("report permissions", () => {
  it("lets an admin or a manager generate a report", () => {
    expect(canManageReports("admin")).toBe(true);
    expect(canManageReports("manager")).toBe(true);
    expect(canManageReports("staff")).toBe(false);
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
