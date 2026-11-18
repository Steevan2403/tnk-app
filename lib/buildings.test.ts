import { describe, expect, it } from "vitest";
import { formatAddress, parseBuildingForm } from "./buildings";

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
