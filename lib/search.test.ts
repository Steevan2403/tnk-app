import { describe, expect, it } from "vitest";
import {
  apartmentSearchWhere,
  assetSearchWhere,
  caseSearchWhere,
  contractorSearchWhere,
  inspectionRunSearchWhere,
  inspectionTemplateSearchWhere,
  isSearchable,
  normalizeSearchQuery,
  orderedGroups,
  residentSearchWhere,
  resultsHref,
  searchPlan,
  workOrderSearchWhere,
  type SearchGroup,
} from "./search";

function group(kind: SearchGroup["kind"], hits: number): SearchGroup {
  return {
    kind,
    label: kind,
    total: hits,
    hits: Array.from({ length: hits }, (_, index) => ({
      id: `${kind}-${index}`,
      title: kind,
      detail: "",
      href: `/${kind}/${index}`,
    })),
  };
}

describe("search query", () => {
  it("trims, collapses spaces, and keeps searches short", () => {
    expect(normalizeSearchQuery("  300-A  ")).toBe("300-A");
    expect(normalizeSearchQuery("Alex   Example")).toBe("Alex Example");
    expect(normalizeSearchQuery(` ${"a".repeat(90)} `)).toHaveLength(80);
    expect(isSearchable(" a ")).toBe(false);
    expect(isSearchable("300")).toBe(true);
    expect(resultsHref(" 300 ")).toBe("/search?q=300");
  });
});

describe("search plan", () => {
  it("keeps building records on the selected building and templates to people who can open them", () => {
    expect(searchPlan("admin", "tower")).toEqual({ building: true, templates: true });
    expect(searchPlan("manager", "tower")).toEqual({ building: true, templates: true });
    expect(searchPlan("staff", "tower")).toEqual({ building: true, templates: false });
    expect(searchPlan("admin", null)).toEqual({ building: false, templates: false });
    expect(searchPlan("staff", null)).toEqual({ building: false, templates: false });
  });
});

describe("record filters", () => {
  it("matches a case by number, subject, or description in one building", () => {
    expect(caseSearchWhere("tower", "300")).toEqual({
      AND: [
        { buildingId: "tower" },
        {
          OR: [
            { subject: { contains: "300" } },
            { descriptionHtml: { contains: "300" } },
            { number: 300 },
          ],
        },
      ],
    });
    expect(caseSearchWhere("tower", "drip")).toEqual({
      AND: [
        { buildingId: "tower" },
        { OR: [{ subject: { contains: "drip" } }, { descriptionHtml: { contains: "drip" } }] },
      ],
    });
    expect(JSON.stringify(caseSearchWhere("court", "300"))).toContain("court");
    expect(JSON.stringify(caseSearchWhere("court", "300"))).not.toContain("tower");
  });

  it("matches a work order by number, subject, or contractor in one building", () => {
    expect(workOrderSearchWhere("tower", "300-a")).toEqual({
      AND: [
        { case: { buildingId: "tower" } },
        {
          OR: [
            { subject: { contains: "300-a" } },
            { companyName: { contains: "300-a" } },
            { company: { name: { contains: "300-a" } } },
            { case: { number: 300 }, suffix: "A" },
          ],
        },
      ],
    });
    expect(workOrderSearchWhere("tower", "300")).toEqual({
      AND: [
        { case: { buildingId: "tower" } },
        {
          OR: [
            { subject: { contains: "300" } },
            { companyName: { contains: "300" } },
            { company: { name: { contains: "300" } } },
            { case: { number: 300 } },
          ],
        },
      ],
    });
  });

  it("matches residents by name, email, phone, apartment, and lot", () => {
    const where = residentSearchWhere("tower", "Alex Example");
    expect(where.AND).toEqual([
      { apartment: { buildingId: "tower" } },
      {
        OR: [
          { firstName: { contains: "Alex" } },
          { lastName: { contains: "Alex" } },
          { email: { contains: "Alex" } },
          { phone: { contains: "Alex" } },
          { mobile: { contains: "Alex" } },
          { secondaryPhone: { contains: "Alex" } },
          { apartment: { number: { contains: "Alex" } } },
          { apartment: { lotNumber: { contains: "Alex" } } },
        ],
      },
      {
        OR: [
          { firstName: { contains: "Example" } },
          { lastName: { contains: "Example" } },
          { email: { contains: "Example" } },
          { phone: { contains: "Example" } },
          { mobile: { contains: "Example" } },
          { secondaryPhone: { contains: "Example" } },
          { apartment: { number: { contains: "Example" } } },
          { apartment: { lotNumber: { contains: "Example" } } },
        ],
      },
    ]);
  });

  it("matches apartments by number or lot in one building", () => {
    expect(apartmentSearchWhere("tower", "104")).toEqual({
      AND: [{ buildingId: "tower" }, { OR: [{ number: { contains: "104" } }, { lotNumber: { contains: "104" } }] }],
    });
  });

  it("matches contractors by company or category for the whole account", () => {
    expect(contractorSearchWhere("Plumbing")).toEqual({
      OR: [{ name: { contains: "Plumbing" } }, { category: { name: { contains: "Plumbing" } } }],
    });
    expect(JSON.stringify(contractorSearchWhere("Plumbing"))).not.toContain("buildingId");
  });

  it("matches assets by name, place, identity, and category in one building", () => {
    expect(assetSearchWhere("tower", "CCTV")).toEqual({
      AND: [
        { buildingId: "tower" },
        {
          OR: [
            { name: { contains: "CCTV" } },
            { location: { contains: "CCTV" } },
            { serialNumber: { contains: "CCTV" } },
            { make: { contains: "CCTV" } },
            { model: { contains: "CCTV" } },
            { category: { name: { contains: "CCTV" } } },
          ],
        },
      ],
    });
  });

  it("matches inspection runs for every role and templates by name or description", () => {
    expect(inspectionRunSearchWhere("tower", "Lot exit")).toEqual({
      AND: [
        { buildingId: "tower" },
        { OR: [{ name: { contains: "Lot exit" } }, { apartment: { number: { contains: "Lot exit" } } }] },
      ],
    });
    expect(inspectionTemplateSearchWhere("tower", "roof")).toEqual({
      AND: [
        { buildingId: "tower" },
        { OR: [{ name: { contains: "roof" } }, { description: { contains: "roof" } }] },
      ],
    });
  });
});

describe("ordered groups", () => {
  it("drops empty groups and keeps the page order", () => {
    const groups = orderedGroups([
      group("asset", 1),
      group("case", 0),
      group("contractor", 2),
      group("work_order", 1),
    ]);
    expect(groups.map((item) => item.kind)).toEqual(["work_order", "contractor", "asset"]);
  });
});
