import { describe, expect, it } from "vitest";
import { parseApartmentTab } from "./residents";
import {
  KEY_CHANGE_DENIED,
  formatKeyType,
  keyApartmentAccess,
  parseKeyForm,
  planKeyDelete,
  planKeySave,
  sortKeys,
  type KeyActor,
  type KeyApartment,
  type StoredKey,
} from "./keys";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const tower = "seed_example_tower";
const court = "seed_sample_court";

const apartment: KeyApartment = { id: "apt-101", buildingId: tower };
const keys: StoredKey[] = [
  { id: "door", number: "101-D" },
  { id: "mail", number: "101-M" },
];

const admin: KeyActor = { role: "admin", selectedBuildingId: tower, memberBuildingIds: [] };
const manager: KeyActor = { role: "manager", selectedBuildingId: tower, memberBuildingIds: [tower] };
const staff: KeyActor = { role: "staff", selectedBuildingId: tower, memberBuildingIds: [tower, court] };

const valid = {
  number: " 101-G ",
  type: "garage_remote",
  location: " Manager office ",
  comment: " Example garage remote. ",
};

describe("key form", () => {
  it("trims a key and leaves optional fields empty", () => {
    expect(parseKeyForm(form(valid))).toEqual({
      ok: true,
      value: {
        number: "101-G",
        type: "garage_remote",
        location: "Manager office",
        comment: "Example garage remote.",
      },
    });
    expect(parseKeyForm(form({ number: "101-G", type: "door", location: " ", comment: "" }))).toEqual({
      ok: true,
      value: { number: "101-G", type: "door", location: null, comment: null },
    });
  });

  it("requires a key number and a known type", () => {
    const missing = parseKeyForm(form({ number: " ", type: "door", location: "Desk", comment: "Spare" }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.number).toBe("Enter a key number.");

    const blankType = parseKeyForm(form({ number: "101-G", type: "", location: "Desk" }));
    expect(blankType.ok).toBe(false);
    if (!blankType.ok) expect(blankType.errors.type).toBe("Choose a key type.");

    const unknown = parseKeyForm(form({ number: "101-G", type: "gate" }));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.type).toBe("Choose a key type.");
  });

  it("limits the length of the number, location, and comment", () => {
    const result = parseKeyForm(
      form({
        number: "K".repeat(41),
        type: "fob",
        location: "L".repeat(81),
        comment: "C".repeat(501),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.number).toBe("Use 40 characters or fewer.");
      expect(result.errors.location).toBe("Use 80 characters or fewer.");
      expect(result.errors.comment).toBe("Use 500 characters or fewer.");
    }
  });
});

describe("key changes", () => {
  it("lets an admin or a manager add a key", () => {
    const created = {
      ok: true,
      action: "create",
      apartmentId: "apt-101",
      value: {
        number: "101-G",
        type: "garage_remote",
        location: "Manager office",
        comment: "Example garage remote.",
      },
    };
    expect(planKeySave({ actor: admin, apartment, keys, formData: form(valid) })).toEqual(created);
    expect(planKeySave({ actor: manager, apartment, keys, formData: form(valid) })).toEqual(created);
  });

  it("lets an admin or a manager edit a key, including keeping its own number", () => {
    const edited = planKeySave({
      actor: manager,
      apartment,
      keys,
      formData: form({ ...valid, number: "101-d", keyId: "door", type: "door", location: "Key cabinet" }),
    });
    expect(edited).toEqual({
      ok: true,
      action: "update",
      keyId: "door",
      value: {
        number: "101-d",
        type: "door",
        location: "Key cabinet",
        comment: "Example garage remote.",
      },
    });
    expect(
      planKeySave({
        actor: admin,
        apartment,
        keys,
        formData: form({ number: "101-D", type: "swipe_card", keyId: "door" }),
      }),
    ).toMatchObject({ ok: true, action: "update", keyId: "door" });
  });

  it("rejects a missing key number and a duplicate on the same apartment", () => {
    const missing = planKeySave({
      actor: admin,
      apartment,
      keys,
      formData: form({ number: "", type: "fob", location: "Front desk", comment: "Spare fob." }),
    });
    expect(missing).toEqual({ ok: false, errors: { number: "Enter a key number." } });

    const duplicate = planKeySave({
      actor: admin,
      apartment,
      keys,
      formData: form({ number: "101-d", type: "fob", location: "Front desk", comment: "Spare fob." }),
    });
    expect(duplicate).toEqual({
      ok: false,
      errors: { number: "That key number is already on this apartment." },
    });

    const editClash = planKeySave({
      actor: manager,
      apartment,
      keys,
      formData: form({ number: "101-M", type: "door", keyId: "door" }),
    });
    expect(editClash).toEqual({
      ok: false,
      errors: { number: "That key number is already on this apartment." },
    });
  });

  it("allows the same key number on a different apartment", () => {
    const result = planKeySave({
      actor: admin,
      apartment,
      keys: [],
      formData: form({ number: "101-D", type: "door" }),
    });
    expect(result).toMatchObject({ ok: true, action: "create", value: { number: "101-D" } });
  });

  it("lets an admin or a manager delete a key", () => {
    expect(planKeyDelete({ actor: admin, apartment, keys, keyId: "door" })).toEqual({ ok: true, keyId: "door" });
    expect(planKeyDelete({ actor: manager, apartment, keys, keyId: "mail" })).toEqual({ ok: true, keyId: "mail" });
  });

  it("does not delete or edit a key that is not on this apartment", () => {
    expect(planKeyDelete({ actor: admin, apartment, keys, keyId: "other" })).toEqual({
      ok: false,
      error: "That key could not be found.",
    });
    expect(
      planKeySave({
        actor: admin,
        apartment,
        keys,
        formData: form({ number: "101-G", type: "other", keyId: "missing" }),
      }),
    ).toEqual({ ok: false, error: "That key could not be found." });
  });

  it("lets staff view keys and blocks add, edit, and delete", () => {
    expect(keyApartmentAccess(staff, apartment)).toEqual({ ok: true });
    expect(planKeySave({ actor: staff, apartment, keys, formData: form(valid) })).toEqual({
      ok: false,
      error: KEY_CHANGE_DENIED,
    });
    expect(
      planKeySave({
        actor: staff,
        apartment,
        keys,
        formData: form({ number: "101-D", type: "door", keyId: "door" }),
      }),
    ).toEqual({ ok: false, error: KEY_CHANGE_DENIED });
    expect(planKeyDelete({ actor: staff, apartment, keys, keyId: "door" })).toEqual({
      ok: false,
      error: KEY_CHANGE_DENIED,
    });
  });
});

describe("keys in another building", () => {
  const elsewhere: KeyApartment = { id: "apt-101", buildingId: tower };

  it("returns 404 when the selected building is not the apartment's building", () => {
    const selectedCourt: KeyActor = { role: "admin", selectedBuildingId: court, memberBuildingIds: [] };
    expect(keyApartmentAccess(selectedCourt, elsewhere)).toEqual({ ok: false, status: 404 });
    expect(planKeySave({ actor: selectedCourt, apartment: elsewhere, keys, formData: form(valid) })).toEqual({
      ok: false,
      status: 404,
    });
    expect(planKeyDelete({ actor: selectedCourt, apartment: elsewhere, keys, keyId: "door" })).toEqual({
      ok: false,
      status: 404,
    });
  });

  it("returns 404 when this person cannot open the selected building", () => {
    const stale: KeyActor = { role: "manager", selectedBuildingId: court, memberBuildingIds: [tower] };
    expect(keyApartmentAccess(stale, { id: "apt-9", buildingId: court })).toEqual({ ok: false, status: 404 });
    expect(keyApartmentAccess(staff, null)).toEqual({ ok: false, status: 404 });
    expect(planKeySave({ actor: stale, apartment: null, keys: [], formData: form(valid) })).toEqual({
      ok: false,
      status: 404,
    });
  });
});

describe("key list", () => {
  it("sorts by key number and names each type", () => {
    expect(sortKeys([{ number: "K10" }, { number: "K2" }, { number: "K1" }]).map((key) => key.number)).toEqual([
      "K1",
      "K2",
      "K10",
    ]);
    expect(formatKeyType("garage_remote")).toBe("Garage remote");
    expect(formatKeyType("swipe_card")).toBe("Swipe card");
    expect(parseApartmentTab("keys")).toBe("keys");
  });
});
