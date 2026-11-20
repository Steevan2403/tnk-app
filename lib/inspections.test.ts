import { describe, expect, it } from "vitest";
import {
  caseFieldsFromItem,
  inspectionLocation,
  inspectionLocationLabel,
  completionDecision,
  planCaseCreates,
  planTemplateDelete,
  progressCount,
  snapshotTemplate,
  templateDeletePrompt,
  templateDeletedActivity,
  type TemplateSnapshotSource,
} from "./inspections";

const template: TemplateSnapshotSource = {
  name: "Monthly common area inspection",
  type: "common_area",
  areas: [
    {
      name: "Car park",
      position: 1,
      items: [
        { name: "Line marking", guidance: null, position: 1 },
        { name: "Roller door", guidance: "Example: watch it travel.", position: 0 },
      ],
    },
    {
      name: "Lobby",
      position: 0,
      items: [{ name: "Entrance doors", guidance: "Check they close fully.", position: 0 }],
    },
  ],
};

describe("snapshot template items into a run", () => {
  it("copies areas and items in order and leaves later template edits alone", () => {
    const snapshot = snapshotTemplate(template);

    template.name = "Renamed template";
    template.areas[1].name = "Foyer";
    template.areas[1].items[0].name = "Front doors";
    template.areas.push({
      name: "Level 9",
      position: 2,
      items: [{ name: "Corridor", guidance: null, position: 0 }],
    });

    expect(snapshot.name).toBe("Monthly common area inspection");
    expect(snapshot.type).toBe("common_area");
    expect(snapshot.areas.map((area) => area.name)).toEqual(["Lobby", "Car park"]);
    expect(snapshot.areas[0].items).toEqual([
      { name: "Entrance doors", guidance: "Check they close fully.", position: 0, result: null, comment: null },
    ]);
    expect(snapshot.areas[1].items.map((item) => item.name)).toEqual(["Roller door", "Line marking"]);
    expect(snapshot.areas[1].items[0].result).toBeNull();
    expect(snapshot.areas).toHaveLength(2);
  });
});

describe("progress counting", () => {
  it("counts pass, fail, and not applicable, and ignores unanswered items", () => {
    expect(
      progressCount([
        { result: "pass" },
        { result: "fail" },
        { result: "na" },
        { result: null },
      ]),
    ).toEqual({ answered: 3, total: 4 });
    expect(progressCount([])).toEqual({ answered: 0, total: 0 });
  });
});

describe("completion with unanswered items", () => {
  it("asks for confirmation when items are unanswered, then completes", () => {
    const items = [{ result: "pass" as const }, { result: null }];

    expect(completionDecision(items, false)).toEqual({ ok: false, reason: "confirm", unanswered: 1 });
    expect(completionDecision(items, true)).toEqual({ ok: true, status: "completed", unanswered: 1 });
  });

  it("completes without confirmation when every item has a result", () => {
    expect(completionDecision([{ result: "fail" }, { result: "na" }], false)).toEqual({
      ok: true,
      status: "completed",
      unanswered: 0,
    });
  });
});

describe("cases from failed items", () => {
  const items = [
    { id: "floor", result: "fail" as const, caseId: null },
    { id: "door", result: "fail" as const, caseId: "case-9" },
    { id: "light", result: "pass" as const, caseId: null },
    { id: "gate", result: "na" as const, caseId: null },
    { id: "stair", result: null, caseId: null },
    { id: "lines", result: "fail" as const, caseId: null },
  ];

  it("creates a case from a failed item once, and not again once it is linked", () => {
    expect(planCaseCreates(items, ["floor"])).toEqual({ createIds: ["floor"], alreadyLinked: [] });
    expect(planCaseCreates(items, ["door"])).toEqual({ createIds: [], alreadyLinked: ["door"] });
    expect(planCaseCreates(items, ["light"])).toEqual({ createIds: [], alreadyLinked: [] });

    const linked = items.map((item) => (item.id === "floor" ? { ...item, caseId: "case-16" } : item));
    expect(planCaseCreates(linked, ["floor"])).toEqual({ createIds: [], alreadyLinked: ["floor"] });
  });

  it("fills the case from the item, using the apartment only for a private lot", () => {
    expect(
      caseFieldsFromItem({
        itemName: "Lobby floor",
        areaName: "Lobby",
        comment: "Example crack near the mailboxes.",
        type: "common_area",
        area: null,
        apartmentId: null,
        assetIds: [],
      }),
    ).toEqual({
      subject: "Lobby floor (Lobby)",
      descriptionHtml: "<p>Example crack near the mailboxes.</p>",
      area: "none",
      apartmentId: null,
      assetIds: [],
    });

    expect(
      caseFieldsFromItem({
        itemName: "Sink",
        areaName: "Kitchen",
        comment: "Example chip.",
        type: "private_lot",
        area: null,
        apartmentId: "apt-104",
        assetIds: [],
      }),
    ).toMatchObject({ area: "apartment", apartmentId: "apt-104", assetIds: [], subject: "Sink (Kitchen)" });

    expect(
      caseFieldsFromItem({
        itemName: "Sink",
        areaName: "Kitchen",
        comment: null,
        type: "private_lot",
        area: null,
        apartmentId: null,
        assetIds: [],
      }).area,
    ).toBe("none");
  });

  it("carries a chosen asset into the case, and leaves an explicit N/A as N/A", () => {
    expect(
      caseFieldsFromItem({
        itemName: "Pump seals",
        areaName: "Plant room",
        comment: "Example drip.",
        type: "common_area",
        area: "asset",
        apartmentId: null,
        assetIds: ["lift-1"],
      }),
    ).toMatchObject({
      area: "asset",
      assetIds: ["lift-1"],
      apartmentId: null,
      subject: "Pump seals (Plant room)",
    });

    expect(
      caseFieldsFromItem({
        itemName: "Sink",
        areaName: "Kitchen",
        comment: null,
        type: "private_lot",
        area: "none",
        apartmentId: "apt-104",
        assetIds: ["lift-1"],
      }),
    ).toMatchObject({ area: "none", apartmentId: null, assetIds: [] });
  });

  it("creates cases for every failed item that does not already have one", () => {
    expect(planCaseCreates(items, items.map((item) => item.id))).toEqual({
      createIds: ["floor", "lines"],
      alreadyLinked: ["door"],
    });
  });
});

describe("inspection location", () => {
  const known = { assetIds: ["lift-1", "pump-1"], apartmentIds: ["apt-104"] };

  it("accepts N/A, a building asset, or a building apartment", () => {
    expect(inspectionLocation({ area: "", assetIds: [], apartmentId: "" }, known)).toEqual({
      ok: true,
      value: { area: "none", assetIds: [], apartmentId: null },
    });
    expect(inspectionLocation({ area: "asset", assetIds: ["lift-1", "lift-1"], apartmentId: "apt-104" }, known)).toEqual({
      ok: true,
      value: { area: "asset", assetIds: ["lift-1"], apartmentId: null },
    });
    expect(inspectionLocation({ area: "apartment", assetIds: ["lift-1"], apartmentId: "apt-104" }, known)).toEqual({
      ok: true,
      value: { area: "apartment", assetIds: [], apartmentId: "apt-104" },
    });
    expect(inspectionLocationLabel({ area: "asset", assetNames: ["QA TEST Lift 1"], apartmentNumber: null })).toBe(
      "Common asset · QA TEST Lift 1",
    );
  });

  it("rejects an asset or apartment from outside the building", () => {
    expect(inspectionLocation({ area: "asset", assetIds: ["other-building"], apartmentId: "" }, known)).toEqual({
      ok: false,
      error: "asset",
    });
    expect(inspectionLocation({ area: "apartment", assetIds: [], apartmentId: "other" }, known)).toEqual({
      ok: false,
      error: "apartment",
    });
    expect(inspectionLocation({ area: "roof", assetIds: [], apartmentId: "" }, known).ok).toBe(false);
  });
});

describe("inspection template delete", () => {
  it("lets an admin or a manager delete, and blocks staff", () => {
    expect(planTemplateDelete("admin")).toEqual({ ok: true });
    expect(planTemplateDelete("manager")).toEqual({ ok: true });
    expect(planTemplateDelete("staff")).toEqual({
      ok: false,
      error: "You do not have permission to delete inspection templates.",
    });
  });

  it("keeps inspections that were already started from the template", () => {
    expect(templateDeletePrompt({ name: "Example roof inspection", completedRuns: 0, activeRuns: 0 }).message).toBe(
      "Delete this inspection template?\nNo inspections have been started from it. This removes the checklist only.",
    );
    expect(
      templateDeletePrompt({ name: "Monthly common area inspection", completedRuns: 2, activeRuns: 1 }).message,
    ).toBe(
      "Delete this inspection template?\n2 completed and 1 in progress inspections keep their checklists, answers, photos, and any cases raised from them. Those records stay.",
    );
    expect(templateDeletedActivity("Monthly common area inspection", 1, 0)).toBe(
      "Deleted inspection template Monthly common area inspection. 1 completed inspection kept its checklist, answers, photos, and any case raised from it.",
    );
    expect(templateDeletedActivity("Example roof inspection", 0, 0)).toBe(
      "Deleted inspection template Example roof inspection. No inspections had been started from it.",
    );
  });
});
