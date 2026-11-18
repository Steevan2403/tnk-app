import { describe, expect, it } from "vitest";
import {
  contactEmail,
  defaultWorkOrderSubject,
  nextWorkOrderSuffix,
  parseWorkOrderForm,
  resolveWorkOrderContact,
  suffixFromRank,
  sydneyDateTimeToUtc,
  type WorkOrderFormContext,
} from "./work-orders";

const companies = [
  {
    id: "fire",
    approved: true,
    assigned: true,
    contacts: [
      { id: "avery", email: "avery.sample@example.com" },
      { id: "blank", email: "  " },
    ],
  },
  {
    id: "pending",
    approved: false,
    assigned: false,
    contacts: [{ id: "riley", email: "riley.demo@example.com" }],
  },
  {
    id: "assigned-pending",
    approved: false,
    assigned: true,
    contacts: [{ id: "riley", email: "riley.demo@example.com" }],
  },
  {
    id: "plumbing",
    approved: true,
    assigned: false,
    contacts: [{ id: "casey", email: "casey.placeholder@example.com" }],
  },
];

const context: WorkOrderFormContext = {
  companies,
  fileIds: ["photo-1"],
};

describe("work order letters", () => {
  it("letters A through Z and then AA", () => {
    expect(suffixFromRank(1)).toBe("A");
    expect(suffixFromRank(2)).toBe("B");
    expect(suffixFromRank(26)).toBe("Z");
    expect(suffixFromRank(27)).toBe("AA");
    expect(suffixFromRank(28)).toBe("AB");
  });

  it("takes the next letter after the highest one already used", () => {
    expect(nextWorkOrderSuffix([])).toBe("A");
    expect(nextWorkOrderSuffix(["A"])).toBe("B");
    expect(nextWorkOrderSuffix(["A", "B"])).toBe("C");
    expect(nextWorkOrderSuffix(["Z"])).toBe("AA");
    expect(nextWorkOrderSuffix(["A", "Z"])).toBe("AA");
    expect(nextWorkOrderSuffix(["AA"])).toBe("AB");
  });
});

describe("work order contacts", () => {
  it("accepts a contact who belongs to the chosen company and has an email", () => {
    expect(resolveWorkOrderContact("fire", "avery", companies)?.email).toBe("avery.sample@example.com");
    expect(resolveWorkOrderContact("plumbing", "casey", companies)?.email).toBe("casey.placeholder@example.com");
    expect(resolveWorkOrderContact("assigned-pending", "riley", companies)?.email).toBe("riley.demo@example.com");
  });

  it("rejects a contact from another company, a contact without an email, and an unassigned pending company", () => {
    expect(resolveWorkOrderContact("fire", "casey", companies)).toBeNull();
    expect(resolveWorkOrderContact("plumbing", "avery", companies)).toBeNull();
    expect(resolveWorkOrderContact("fire", "blank", companies)).toBeNull();
    expect(resolveWorkOrderContact("pending", "riley", companies)).toBeNull();
    expect(contactEmail("not-an-email")).toBeNull();
  });

  it("rejects the form when the contact is not on that company", () => {
    const data = new FormData();
    data.set("companyId", "fire");
    data.set("contactId", "casey");
    data.set("subject", defaultWorkOrderSubject(6, "A", "Example noise"));
    data.set("message", "Example instructions.");
    const parsed = parseWorkOrderForm(data, context);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.contactId).toBe("Choose a contact of that company with an email.");
  });
});

describe("Sydney date and time", () => {
  it("stores a Sydney wall time as UTC", () => {
    expect(sydneyDateTimeToUtc("2026-11-18T09:00")?.toISOString()).toBe("2026-11-17T22:00:00.000Z");
    expect(sydneyDateTimeToUtc("2026-11-18")).toBeNull();
  });
});
