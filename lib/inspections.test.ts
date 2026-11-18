import { describe, expect, it } from "vitest";
import {
  caseFieldsFromItem,
  completionDecision,
  planCaseCreates,
  progressCount,
  snapshotTemplate,
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
        apartmentId: null,
      }),
    ).toEqual({
      subject: "Lobby floor (Lobby)",
      descriptionHtml: "<p>Example crack near the mailboxes.</p>",
      area: "none",
      apartmentId: null,
    });

    expect(
      caseFieldsFromItem({
        itemName: "Sink",
        areaName: "Kitchen",
        comment: "Example chip.",
        type: "private_lot",
        apartmentId: "apt-104",
      }),
    ).toMatchObject({ area: "apartment", apartmentId: "apt-104", subject: "Sink (Kitchen)" });

    expect(
      caseFieldsFromItem({
        itemName: "Sink",
        areaName: "Kitchen",
        comment: null,
        type: "private_lot",
        apartmentId: null,
      }).area,
    ).toBe("none");
  });

  it("creates cases for every failed item that does not already have one", () => {
    expect(planCaseCreates(items, items.map((item) => item.id))).toEqual({
      createIds: ["floor", "lines"],
      alreadyLinked: ["door"],
    });
  });
});
