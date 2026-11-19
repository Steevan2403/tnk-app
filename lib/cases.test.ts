import { describe, expect, it } from "vitest";
import { sanitizeCaseHtml } from "./case-html";
import {
  FIRST_CASE_NUMBER,
  caseRankPatch,
  compareCases,
  nextCaseNumber,
  overdueCaseWhere,
  overdueCases,
  parseCaseForm,
  statusChange,
  type CaseFormContext,
  type CasePriority,
  type CaseStatus,
} from "./cases";

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) data.append(key, item);
    } else data.set(key, value);
  }
  return data;
}

const context: CaseFormContext = {
  typeIds: ["repair"],
  assetIds: ["pump", "lift"],
  apartmentIds: ["apt-101"],
  companies: [
    { id: "fire", contactIds: ["avery"] },
    { id: "plumbing", contactIds: ["casey"] },
  ],
};

const valid = {
  typeId: "repair",
  purchaseOrderNumber: "PO-EX-1001",
  startDate: "2026-11-01",
  dueDate: "2026-11-08",
  priority: "low",
  status: "new",
  area: "asset",
  assetId: ["pump"],
  companyId: ["fire"],
  contactId: ["avery"],
  subject: "Example plant room drip",
  description: "<p>Example drip.</p>",
  internalNotes: "Example note",
  includeInReport: "on",
};

describe("case numbers per building", () => {
  it("starts at 300 and stays independent for each building", () => {
    expect(FIRST_CASE_NUMBER).toBe(300);

    const tower: number[] = [];
    const court: number[] = [];

    expect(nextCaseNumber(tower)).toBe(300);
    tower.push(300);
    expect(nextCaseNumber(court)).toBe(300);
    court.push(300);
    tower.push(nextCaseNumber(tower));

    expect(tower).toEqual([300, 301]);
    expect(nextCaseNumber(court)).toBe(301);
    expect(nextCaseNumber([300, 302])).toBe(303);
    expect(nextCaseNumber([1, 16])).toBe(300);
    expect(nextCaseNumber([400])).toBe(401);
  });
});

describe("due date", () => {
  it("rejects a due date before the start date and allows the same day", () => {
    const early = parseCaseForm(form({ ...valid, startDate: "2026-11-18", dueDate: "2026-11-17" }), context);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.errors.dueDate).toBe("Due date cannot be before the start date.");

    const sameDay = parseCaseForm(form({ ...valid, startDate: "2026-11-18", dueDate: "2026-11-18" }), context);
    expect(sameDay.ok).toBe(true);
    if (sameDay.ok) {
      expect(sameDay.value.startDate.toISOString()).toBe("2026-11-18T00:00:00.000Z");
      expect(sameDay.value.dueDate.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    }
  });
});

describe("contractor contacts", () => {
  it("accepts contacts of the chosen companies and rejects the others", () => {
    const chosen = parseCaseForm(form(valid), context);
    expect(chosen.ok).toBe(true);
    if (chosen.ok) expect(chosen.value.contactIds).toEqual(["avery"]);

    const otherCompany = parseCaseForm(form({ ...valid, contactId: ["casey"] }), context);
    expect(otherCompany.ok).toBe(false);
    if (!otherCompany.ok) {
      expect(otherCompany.errors.contactIds).toBe("Choose contacts from the selected companies.");
    }

    const noCompany = parseCaseForm(form({ ...valid, companyId: [], contactId: ["avery"] }), context);
    expect(noCompany.ok).toBe(false);
    if (!noCompany.ok) expect(noCompany.errors.contactIds).toBe("Choose contacts from the selected companies.");
  });
});

describe("overdue cases", () => {
  const cases = [
    { id: "yesterday", dueDate: new Date("2026-11-17T00:00:00.000Z"), status: "new" },
    { id: "today", dueDate: new Date("2026-11-18T00:00:00.000Z"), status: "in_progress" },
    { id: "done", dueDate: new Date("2026-11-01T00:00:00.000Z"), status: "completed" },
    { id: "closed", dueDate: new Date("2026-11-01T00:00:00.000Z"), status: "closed" },
    { id: "future", dueDate: new Date("2026-11-20T00:00:00.000Z"), status: "awaiting_quote" },
  ];

  it("returns open cases due before today in Sydney", () => {
    // 17 Nov 2026 13:00 UTC is 18 Nov 2026 00:00 in Sydney (AEDT, UTC+11).
    const sydneyMorning = new Date("2026-11-17T13:00:00.000Z");
    expect(overdueCases(cases, sydneyMorning).map((item) => item.id)).toEqual(["yesterday"]);
    expect(overdueCaseWhere(sydneyMorning)).toEqual({
      dueDate: { lt: new Date("2026-11-18T00:00:00.000Z") },
      status: { notIn: ["completed", "closed"] },
    });

    // One minute earlier is still 17 Nov in Sydney, so a case due that day is not overdue.
    const beforeMidnight = new Date("2026-11-17T12:59:00.000Z");
    expect(overdueCases(cases, beforeMidnight).map((item) => item.id)).toEqual([]);
    expect(overdueCaseWhere(beforeMidnight).dueDate.lt.toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
});

describe("case html", () => {
  it("keeps formatting and links and drops scripts and unsafe urls", () => {
    const clean = sanitizeCaseHtml(
      [
        "<p>Hello <strong>there</strong> <em>friend</em> <u>today</u></p>",
        "<ul><li>One</li></ul>",
        "<ol><li>Two</li></ol>",
        '<a href="https://example.com/path">site</a>',
        "<script>alert(1)</script>",
        '<img src="x" onerror="alert(1)">',
        '<a href="javascript:alert(1)">bad</a>',
      ].join(""),
    );

    expect(clean).toContain("<strong>there</strong>");
    expect(clean).toContain("<em>friend</em>");
    expect(clean).toContain("<u>today</u>");
    expect(clean).toContain("<ul>");
    expect(clean).toContain("<li>One</li>");
    expect(clean).toContain("<ol>");
    expect(clean).toContain('href="https://example.com/path"');
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("alert");
    expect(sanitizeCaseHtml("<p><br></p>")).toBe("");
  });
});

describe("status change activity", () => {
  const now = new Date("2026-11-18T01:00:00.000Z");

  it("records a status change and sets completedAt for completed and closed", () => {
    const started = statusChange({ from: "new", to: "in_progress", completedAt: null, now });
    expect(started).toEqual({
      status: "in_progress",
      completedAt: null,
      activity: {
        kind: "status_changed",
        summary: "Status changed from New to In progress.",
      },
    });

    const done = statusChange({ from: "in_progress", to: "completed", completedAt: null, now });
    expect(done?.completedAt).toEqual(now);
    expect(done?.activity?.summary).toBe("Status changed from In progress to Completed.");

    const closed = statusChange({ from: "completed", to: "closed", completedAt: now, now });
    expect(closed?.completedAt).toEqual(now);
    expect(closed?.activity?.summary).toBe("Status changed from Completed to Closed.");

    const reopened = statusChange({ from: "completed", to: "new", completedAt: now, now });
    expect(reopened?.completedAt).toBeNull();
    expect(reopened?.activity?.summary).toBe("Status changed from Completed to New.");

    const same = statusChange({ from: "new", to: "new", completedAt: null, now });
    expect(same?.activity).toBeNull();
    expect(statusChange({ from: "new", to: "paused", completedAt: null, now })).toBeNull();
  });
});

describe("case list order", () => {
  const row = (priority: CasePriority, status: CaseStatus, number: number) => ({
    number,
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    subject: "Example",
    typeName: "Repair",
    priority,
    status,
  });

  it("ranks priority and status the same way the list comparison does", () => {
    const priorities: CasePriority[] = ["low", "urgent", "medium", "high"];
    const byRank = [...priorities].sort(
      (a, b) => (caseRankPatch({ priority: a }).priorityRank ?? 0) - (caseRankPatch({ priority: b }).priorityRank ?? 0),
    );
    const byCompare = [...priorities].sort((a, b) => compareCases(row(a, "new", 1), row(b, "new", 1), "priority", "asc"));
    expect(byRank).toEqual(byCompare);

    const statuses: CaseStatus[] = ["closed", "new", "completed", "awaiting_quote", "in_progress"];
    const statusRank = [...statuses].sort(
      (a, b) => (caseRankPatch({ status: a }).statusRank ?? 0) - (caseRankPatch({ status: b }).statusRank ?? 0),
    );
    const statusCompare = [...statuses].sort((a, b) =>
      compareCases(row("low", a, 1), row("low", b, 1), "status", "asc"),
    );
    expect(statusRank).toEqual(statusCompare);
    expect(caseRankPatch({ priority: "nope", status: "paused" })).toEqual({});
  });
});
