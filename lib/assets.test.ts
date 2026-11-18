import { describe, expect, it } from "vitest";
import {
  assetsWithExpiredWarranty,
  expiredWarrantyWhere,
  parseAssetForm,
  photoCountError,
  type AssetFormContext,
} from "./assets";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const context: AssetFormContext = {
  categoryIds: ["pumps", "lifts"],
  companies: [
    { id: "fire", contactIds: ["avery"] },
    { id: "plumbing", contactIds: ["casey"] },
  ],
};

const valid = {
  name: "Fire pump 1",
  categoryId: "pumps",
  location: "Plant room",
  make: "Example",
  model: "FP-100",
  serialNumber: "SN-FP-001",
  barcode: "BC-FP-001",
  purchasedOn: "2019-03-12",
  assetValue: "18500",
  endOfLifeValue: "2000",
  lifeMonths: "240",
  description: "Example pump",
  companyId: "fire",
  contactId: "avery",
};

describe("asset value and estimated life", () => {
  it("accepts an end-of-life value equal to the asset value and a whole number of months", () => {
    const result = parseAssetForm(
      form({ ...valid, assetValue: "100", endOfLifeValue: "100.00", lifeMonths: " 18 " }),
      context,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assetValue).toBe("100.00");
      expect(result.value.endOfLifeValue).toBe("100.00");
      expect(result.value.lifeMonths).toBe(18);
    }
  });

  it("rejects an end-of-life value greater than the asset value", () => {
    const higher = parseAssetForm(form({ ...valid, assetValue: "100", endOfLifeValue: "100.01" }), context);
    expect(higher.ok).toBe(false);
    if (!higher.ok) {
      expect(higher.errors.endOfLifeValue).toBe("End-of-life value cannot be more than the asset value.");
    }

    const missingAsset = parseAssetForm(form({ ...valid, assetValue: "", endOfLifeValue: "1" }), context);
    expect(missingAsset.ok).toBe(false);
    if (!missingAsset.ok) {
      expect(missingAsset.errors.endOfLifeValue).toBe("End-of-life value cannot be more than the asset value.");
    }
  });

  it("rejects a life that is not a whole number of months", () => {
    for (const lifeMonths of ["12.5", "12.0", "12 months", "-3", "1e2"]) {
      const result = parseAssetForm(form({ ...valid, lifeMonths }), context);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.lifeMonths).toBe("Enter the estimated life in whole months.");
    }
  });
});

describe("asset photos", () => {
  it("allows up to 15 photos in total", () => {
    expect(photoCountError(0, 15)).toBeNull();
    expect(photoCountError(14, 1)).toBeNull();
  });

  it("rejects a 16th photo and an empty selection", () => {
    expect(photoCountError(14, 2)).toBe("An asset can have up to 15 photos.");
    expect(photoCountError(15, 1)).toBe("An asset can have up to 15 photos.");
    expect(photoCountError(0, 16)).toBe("An asset can have up to 15 photos.");
    expect(photoCountError(0, 0)).toBe("Choose an image.");
  });
});

describe("service company contact", () => {
  it("accepts a contact that belongs to the selected company", () => {
    const result = parseAssetForm(form({ ...valid, companyId: "plumbing", contactId: "casey" }), context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.companyId).toBe("plumbing");
      expect(result.value.contactId).toBe("casey");
    }
  });

  it("rejects a contact from another company", () => {
    const other = parseAssetForm(form({ ...valid, companyId: "fire", contactId: "casey" }), context);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.errors.contactId).toBe("Choose a contact from the selected company.");

    const missingCompany = parseAssetForm(form({ ...valid, companyId: "", contactId: "avery" }), context);
    expect(missingCompany.ok).toBe(false);
    if (!missingCompany.ok) expect(missingCompany.errors.contactId).toBe("Choose a contact from the selected company.");
  });
});

describe("assets with an expired warranty", () => {
  const today = new Date("2026-11-17T13:30:00.000Z");
  const assets = [
    { id: "yesterday", warranties: [{ expiresOn: new Date("2026-11-17T00:00:00.000Z") }] },
    { id: "today", warranties: [{ expiresOn: new Date("2026-11-18T00:00:00.000Z") }] },
    { id: "future", warranties: [{ expiresOn: new Date("2028-06-30T00:00:00.000Z") }] },
    { id: "none", warranties: [] },
    {
      id: "mixed",
      warranties: [
        { expiresOn: new Date("2024-01-15T00:00:00.000Z") },
        { expiresOn: new Date("2028-06-30T00:00:00.000Z") },
      ],
    },
  ];

  it("uses the Sydney calendar day as the cutoff", () => {
    expect(expiredWarrantyWhere(today)).toEqual({
      warranties: { some: { expiresOn: { lt: new Date("2026-11-18T00:00:00.000Z") } } },
    });
  });

  it("returns assets with any warranty expiring before today", () => {
    expect(assetsWithExpiredWarranty(assets, today).map((asset) => asset.id)).toEqual(["yesterday", "mixed"]);
  });
});
