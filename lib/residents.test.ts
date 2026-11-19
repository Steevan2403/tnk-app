import { describe, expect, it } from "vitest";
import { compareLabel, formatLotNumber, parseApartmentForm, parseResidentForm, type ApartmentIdentity } from "./residents";

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

  it("creates an apartment when the lot number is left blank", () => {
    const blank = parseApartmentForm(form({ number: "201" }), apartments, "tower");
    expect(blank).toEqual({ ok: true, value: { number: "201", lotNumber: null } });

    const spaces = parseApartmentForm(form({ number: "202", lotNumber: "   " }), apartments, "tower");
    expect(spaces).toEqual({ ok: true, value: { number: "202", lotNumber: null } });

    const another = parseApartmentForm(form({ number: "203" }), [
      ...apartments,
      { id: "tower-201", buildingId: "tower", number: "201", lotNumber: null },
    ], "tower");
    expect(another).toEqual({ ok: true, value: { number: "203", lotNumber: null } });
  });

  it("still limits a lot number that is entered", () => {
    const result = parseApartmentForm(form({ number: "201", lotNumber: "123456789012345678901" }), apartments, "tower");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.lotNumber).toBe("Use 20 characters or fewer.");
  });

  it("still rejects a missing apartment number", () => {
    const missing = parseApartmentForm(form({ number: " ", lotNumber: "9" }), apartments, "tower");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors.number).toBe("Enter an apartment number.");
      expect(missing.errors.lotNumber).toBeUndefined();
    }

    const empty = parseApartmentForm(form({ lotNumber: "" }), apartments, "tower");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors.number).toBe("Enter an apartment number.");
  });

  it("lets an edit clear the lot number and still rejects a lot that is already used", () => {
    const cleared = parseApartmentForm(form({ number: "101", lotNumber: "" }), apartments, "tower", "tower-101");
    expect(cleared).toEqual({ ok: true, value: { number: "101", lotNumber: null } });

    const duplicate = parseApartmentForm(form({ number: "201", lotNumber: "1" }), [
      ...apartments,
      { id: "tower-201", buildingId: "tower", number: "201", lotNumber: null },
    ], "tower");
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors.lotNumber).toBe("That lot number is already used in this building.");
  });

  it("shows a dash for a blank lot and sorts it without throwing", () => {
    expect(formatLotNumber(null)).toBe("—");
    expect(formatLotNumber("")).toBe("—");
    expect(formatLotNumber("  ")).toBe("—");
    expect(formatLotNumber("4")).toBe("4");
    expect(compareLabel(null, "2")).toBeLessThan(0);
    expect(compareLabel(null, null)).toBe(0);
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
