import { describe, expect, it } from "vitest";
import { parseApartmentForm, parseResidentForm, type ApartmentIdentity } from "./residents";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const apartments: ApartmentIdentity[] = [
  { id: "tower-101", buildingId: "tower", number: "101", lotNumber: "1" },
  { id: "tower-102", buildingId: "tower", number: "102", lotNumber: "2" },
  { id: "court-101", buildingId: "court", number: "101", lotNumber: "1" },
];

describe("apartment and lot numbers", () => {
  it("rejects a number or lot already used in the same building", () => {
    const result = parseApartmentForm(form({ number: "101", lotNumber: "2" }), apartments, "tower");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.number).toBe("That apartment number is already used in this building.");
      expect(result.errors.lotNumber).toBe("That lot number is already used in this building.");
    }
  });

  it("allows the same number and lot in another building", () => {
    const result = parseApartmentForm(form({ number: "101", lotNumber: "1" }), apartments, "harbour");
    expect(result).toEqual({ ok: true, value: { number: "101", lotNumber: "1" } });
  });

  it("ignores the apartment being edited and treats case as the same number", () => {
    const same = parseApartmentForm(form({ number: "101", lotNumber: "1" }), apartments, "tower", "tower-101");
    expect(same.ok).toBe(true);

    const clash = parseApartmentForm(form({ number: "A1", lotNumber: "9" }), [
      ...apartments,
      { id: "tower-a", buildingId: "tower", number: "a1", lotNumber: "8" },
    ], "tower");
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.errors.number).toBe("That apartment number is already used in this building.");
  });
});

describe("resident form", () => {
  const context = {
    apartmentIds: ["tower-101", "tower-102"],
    primaryResidentIds: ["resident-alex"],
  };

  function resident(fields: Record<string, string>, extra?: Partial<typeof context & { ignoreId?: string }>) {
    return parseResidentForm(form(fields), { ...context, ...extra });
  }

  const valid = {
    apartmentId: "tower-102",
    firstName: "Taylor",
    lastName: "Example",
    type: "tenant",
    phone: "",
    mobile: "0400 000 999",
    secondaryPhone: "",
    email: "Taylor@Example.com",
    moveInOn: "2024-01-01",
    moveOutOn: "2024-06-01",
    notes: "",
  };

  it("accepts a valid email and lowercases it", () => {
    const result = resident(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("taylor@example.com");
  });

  it("rejects an email without a name and a domain", () => {
    const result = resident({ ...valid, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBe("Enter a valid email address.");
  });

  it("allows one primary contact and rejects a second", () => {
    const first = resident({ ...valid, primaryContact: "on" }, { primaryResidentIds: [], ignoreId: undefined });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.primaryContact).toBe(true);

    const second = resident({ ...valid, apartmentId: "tower-101", primaryContact: "on" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.errors.primaryContact).toBe("This apartment already has a primary contact.");
    }
  });

  it("lets the existing primary contact stay primary", () => {
    const result = resident(
      { ...valid, apartmentId: "tower-101", primaryContact: "on" },
      { ignoreId: "resident-alex" },
    );
    expect(result.ok).toBe(true);
  });

  it("requires move-out to be after move-in", () => {
    const before = resident({ ...valid, moveInOn: "2024-06-01", moveOutOn: "2024-01-01" });
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.errors.moveOutOn).toBe("Move-out must be after move-in.");

    const sameDay = resident({ ...valid, moveInOn: "2024-06-01", moveOutOn: "2024-06-01" });
    expect(sameDay.ok).toBe(false);
    if (!sameDay.ok) expect(sameDay.errors.moveOutOn).toBe("Move-out must be after move-in.");

    const missingMoveIn = resident({ ...valid, moveInOn: "", moveOutOn: "2024-06-01" });
    expect(missingMoveIn.ok).toBe(false);
    if (!missingMoveIn.ok) {
      expect(missingMoveIn.errors.moveOutOn).toBe("Enter a move-in date before the move-out date.");
    }

    const after = resident({ ...valid, moveInOn: "2024-01-01", moveOutOn: "2024-01-02" });
    expect(after.ok).toBe(true);
  });
});
