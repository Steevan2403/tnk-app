import { describe, expect, it } from "vitest";
import {
  actionCounts,
  canAddBuildingNote,
  canDeleteBuildingNote,
  canEditBuildingNote,
  canManageUsefulNumbers,
  casesByType,
  chartPeriodStart,
  failedItemsWithoutCase,
  parseChartPeriod,
} from "./dashboard";

const sydneyMorning = new Date("2026-11-17T13:00:00.000Z");

describe("action counts", () => {
  const cases = [
    { dueDate: new Date("2026-10-08T00:00:00.000Z"), status: "in_progress" },
    { dueDate: new Date("2026-11-18T00:00:00.000Z"), status: "new" },
    { dueDate: new Date("2026-09-10T00:00:00.000Z"), status: "completed" },
    { dueDate: new Date("2026-06-08T00:00:00.000Z"), status: "closed" },
  ];
  const assets = [
    { warranties: [{ expiresOn: new Date("2024-01-15T00:00:00.000Z") }] },
    { warranties: [{ expiresOn: new Date("2028-06-30T00:00:00.000Z") }] },
    { warranties: [] },
  ];
  const companies = [
    { insurances: [{ expiresOn: new Date("2024-05-01T00:00:00.000Z") }] },
    { insurances: [{ expiresOn: new Date("2028-06-30T00:00:00.000Z") }] },
    { insurances: [] },
  ];
  const failedItems = [
    { result: "fail", caseId: "case-16", completedAt: new Date("2026-10-20T04:00:00.000Z") },
    { result: "fail", caseId: null, completedAt: new Date("2026-10-20T04:00:00.000Z") },
    { result: "fail", caseId: null, completedAt: new Date("2026-11-02T03:00:00.000Z") },
    { result: "fail", caseId: null, completedAt: new Date("2026-08-19T04:00:00.000Z") },
    { result: "fail", caseId: null, completedAt: null },
    { result: "pass", caseId: null, completedAt: new Date("2026-11-02T03:00:00.000Z") },
  ];

  it("counts overdue cases, overdue visits, expired cover, and open failed items", () => {
    expect(
      actionCounts({
        cases,
        overdueVisits: [{ id: "a" }, { id: "b" }, { id: "c" }],
        assets,
        companies,
        failedItems,
        today: sydneyMorning,
      }),
    ).toEqual({
      overdueCases: 1,
      overdueMaintenance: 3,
      expiredWarranties: 1,
      expiredInsurance: 1,
      failedInspections: 2,
    });
  });

  it("returns zeros when nothing needs action", () => {
    expect(
      actionCounts({
        cases: [{ dueDate: new Date("2026-12-01T00:00:00.000Z"), status: "new" }],
        overdueVisits: [],
        assets: [{ warranties: [{ expiresOn: new Date("2028-01-01T00:00:00.000Z") }] }],
        companies: [{ insurances: [] }],
        failedItems: [],
        today: sydneyMorning,
      }),
    ).toEqual({
      overdueCases: 0,
      overdueMaintenance: 0,
      expiredWarranties: 0,
      expiredInsurance: 0,
      failedInspections: 0,
    });
  });

  it("keeps a failed item on the first day of the 90-day window", () => {
    const items = failedItemsWithoutCase(
      [{ result: "fail", caseId: null, completedAt: new Date("2026-08-20T04:00:00.000Z") }],
      sydneyMorning,
    );
    expect(items).toHaveLength(1);
  });
});

describe("cases by type", () => {
  const cases = [
    { startDate: new Date("2026-10-01T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-11-01T00:00:00.000Z"), typeId: "approval", typeName: "Approval" },
    { startDate: new Date("2026-11-10T00:00:00.000Z"), typeId: "move-in", typeName: "Moving in" },
    { startDate: new Date("2026-11-05T00:00:00.000Z"), typeId: "pest", typeName: "Pest control" },
    { startDate: new Date("2026-07-01T00:00:00.000Z"), typeId: "cleaning", typeName: "Cleaning" },
    { startDate: new Date("2026-09-01T00:00:00.000Z"), typeId: "complaint", typeName: "Complaint" },
    { startDate: new Date("2026-11-02T00:00:00.000Z"), typeId: "fire", typeName: "Fire safety" },
    { startDate: new Date("2026-11-12T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-11-05T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-06-01T00:00:00.000Z"), typeId: "move-out", typeName: "Moving out" },
    { startDate: new Date("2026-11-15T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-11-08T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-11-11T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-08-01T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-11-16T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
    { startDate: new Date("2026-10-20T00:00:00.000Z"), typeId: "repair", typeName: "Repair & maintenance" },
  ];

  it("defaults to 3 months and clamps the day when the earlier month is shorter", () => {
    expect(parseChartPeriod("")).toBe(3);
    expect(parseChartPeriod("2")).toBe(3);
    expect(parseChartPeriod("12")).toBe(12);
    expect(chartPeriodStart(3, sydneyMorning).toISOString()).toBe("2026-08-18T00:00:00.000Z");
    expect(chartPeriodStart(1, new Date("2026-03-30T13:00:00.000Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("groups cases started in each period", () => {
    expect(casesByType(cases, 3, sydneyMorning)).toEqual([
      { typeId: "repair", typeName: "Repair & maintenance", count: 8 },
      { typeId: "approval", typeName: "Approval", count: 1 },
      { typeId: "complaint", typeName: "Complaint", count: 1 },
      { typeId: "fire", typeName: "Fire safety", count: 1 },
      { typeId: "move-in", typeName: "Moving in", count: 1 },
      { typeId: "pest", typeName: "Pest control", count: 1 },
    ]);

    expect(casesByType(cases, 1, sydneyMorning).find((item) => item.typeId === "repair")?.count).toBe(7);
    expect(casesByType(cases, 1, sydneyMorning)).toHaveLength(5);

    const six = casesByType(cases, 6, sydneyMorning);
    expect(six.reduce((sum, item) => sum + item.count, 0)).toBe(16);
    expect(six.find((item) => item.typeId === "repair")?.count).toBe(9);

    expect(casesByType(cases, 12, sydneyMorning)).toEqual(six);
  });

  it("leaves the period empty when every case started earlier", () => {
    expect(casesByType(cases, 1, new Date("2026-05-19T14:00:00.000Z"))).toEqual([]);
  });
});

describe("notes and useful numbers permissions", () => {
  it("lets every role add a note and edit only their own", () => {
    expect(canAddBuildingNote("admin")).toBe(true);
    expect(canAddBuildingNote("manager")).toBe(true);
    expect(canAddBuildingNote("staff")).toBe(true);
    expect(canAddBuildingNote("guest")).toBe(false);

    expect(canEditBuildingNote("admin", "user-1", "user-1")).toBe(true);
    expect(canEditBuildingNote("admin", "user-2", "user-1")).toBe(false);
    expect(canEditBuildingNote("manager", "user-2", "user-1")).toBe(false);
    expect(canEditBuildingNote("staff", "user-1", "user-1")).toBe(true);
    expect(canEditBuildingNote("staff", "user-2", "user-1")).toBe(false);
  });

  it("lets staff delete their own notes and lets admin or manager delete any", () => {
    expect(canDeleteBuildingNote("staff", "user-1", "user-1")).toBe(true);
    expect(canDeleteBuildingNote("staff", "user-2", "user-1")).toBe(false);
    expect(canDeleteBuildingNote("admin", "user-2", "user-1")).toBe(true);
    expect(canDeleteBuildingNote("manager", "user-2", "user-1")).toBe(true);
    expect(canDeleteBuildingNote("guest", "user-1", "user-1")).toBe(false);
  });

  it("lets an admin or a manager change useful numbers and lets staff view only", () => {
    expect(canManageUsefulNumbers("admin")).toBe(true);
    expect(canManageUsefulNumbers("manager")).toBe(true);
    expect(canManageUsefulNumbers("staff")).toBe(false);
  });
});
