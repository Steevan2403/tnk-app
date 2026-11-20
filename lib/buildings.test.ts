import { describe, expect, it } from "vitest";
import { canUseBuilding, formatAddress, parseBuildingForm, selectedBuildingForUser } from "./buildings";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  name: "Example Tower",
  address: "100 Example Street",
  suburb: "Sydney",
  state: "NSW",
  postcode: "2000",
  photoUrl: "",
  lotCount: "48",
};

const tower = "seed_example_tower";
const court = "seed_sample_court";

describe("building membership", () => {
  it("keeps a manager on Example Tower and drops Sample Court", () => {
    expect(canUseBuilding("manager", tower, [tower])).toBe(true);
    expect(canUseBuilding("manager", court, [tower])).toBe(false);
    expect(selectedBuildingForUser("manager", court, [tower])).toBeNull();
    expect(selectedBuildingForUser("manager", tower, [tower])).toBe(tower);
  });

  it("lets an admin keep any selected building, including one with no membership row", () => {
    expect(canUseBuilding("admin", court, [])).toBe(true);
    expect(selectedBuildingForUser("admin", court, [])).toBe(court);
  });

  it("gives a person with no buildings no selected building", () => {
    expect(selectedBuildingForUser("staff", tower, [])).toBeNull();
    expect(selectedBuildingForUser("staff", null, [tower])).toBeNull();
  });

  it("lets staff open only the buildings they are assigned", () => {
    expect(canUseBuilding("staff", tower, [tower, court])).toBe(true);
    expect(canUseBuilding("staff", court, [tower, court])).toBe(true);
    expect(selectedBuildingForUser("staff", court, [tower])).toBeNull();
  });
});

describe("parseBuildingForm", () => {
  it("accepts a complete building", () => {
    const result = parseBuildingForm(
      form({ ...valid, photoUrl: "https://images.example/tower.jpg" }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Example Tower",
        address: "100 Example Street",
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
        photoUrl: "https://images.example/tower.jpg",
        lotCount: 48,
        strataPlan: null,
        siteContactName: null,
        siteContactMobile: null,
        siteContactEmail: null,
      },
    });
  });

  it("trims text and uppercases the state", () => {
    const result = parseBuildingForm(form({ ...valid, name: "  Sample Court  ", state: "nsw" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Sample Court");
      expect(result.value.state).toBe("NSW");
      expect(result.value.photoUrl).toBeNull();
    }
  });

  it("reports each invalid field", () => {
    const result = parseBuildingForm(
      form({
        name: "",
        address: "",
        suburb: "",
        state: "Sydney",
        postcode: "20",
        photoUrl: "javascript:alert(1)",
        lotCount: "1.5",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBeTruthy();
      expect(result.errors.address).toBeTruthy();
      expect(result.errors.suburb).toBeTruthy();
      expect(result.errors.state).toBeTruthy();
      expect(result.errors.postcode).toBeTruthy();
      expect(result.errors.photoUrl).toBeTruthy();
      expect(result.errors.lotCount).toBeTruthy();
    }
  });
});

describe("building site contact", () => {
  it("keeps an optional strata plan and site contact", () => {
    const result = parseBuildingForm(
      form({
        ...valid,
        strataPlan: " SP 10048 ",
        siteContactName: " Alex Example ",
        siteContactMobile: "0400 000 001",
        siteContactEmail: "site.tower@example.com",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.strataPlan).toBe("SP 10048");
      expect(result.value.siteContactName).toBe("Alex Example");
      expect(result.value.siteContactMobile).toBe("0400 000 001");
      expect(result.value.siteContactEmail).toBe("site.tower@example.com");
    }
  });

  it("rejects a site contact email that is not an email", () => {
    const result = parseBuildingForm(form({ ...valid, siteContactEmail: "not-an-email" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.siteContactEmail).toBeTruthy();
  });
});

describe("formatAddress", () => {
  it("joins the street, suburb, state, and postcode", () => {
    expect(
      formatAddress({
        address: "8 Sample Road",
        suburb: "Pyrmont",
        state: "NSW",
        postcode: "2009",
      }),
    ).toBe("8 Sample Road, Pyrmont NSW 2009");
  });
});
