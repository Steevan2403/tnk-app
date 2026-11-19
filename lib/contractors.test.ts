import { describe, expect, it } from "vitest";
import {
  companiesWithExpiredInsurance,
  contractorCategoryInUseMessage,
  contractorCategoryNameTaken,
  expiredInsuranceWhere,
  insuranceStanding,
  normalizeAbn,
  normalizeEmail,
  normalizeWebsite,
  parseCompanyForm,
  parseContractorCategoryName,
} from "./contractors";
import { canManageContractors } from "./roles";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("normalizeAbn", () => {
  it("accepts 11 digits and strips spaces and hyphens", () => {
    expect(normalizeAbn("")).toEqual({ ok: true, abn: null });
    expect(normalizeAbn("  ")).toEqual({ ok: true, abn: null });
    expect(normalizeAbn("11111111111")).toEqual({ ok: true, abn: "11111111111" });
    expect(normalizeAbn("11 111 111 111")).toEqual({ ok: true, abn: "11111111111" });
    expect(normalizeAbn("11-111-111-111")).toEqual({ ok: true, abn: "11111111111" });
  });

  it("rejects a value that is not 11 digits", () => {
    expect(normalizeAbn("1111111111")).toEqual({ ok: false });
    expect(normalizeAbn("111111111111")).toEqual({ ok: false });
    expect(normalizeAbn("1111111111A")).toEqual({ ok: false });
    expect(normalizeAbn("ABN 11111111111")).toEqual({ ok: false });
  });
});

describe("normalizeEmail", () => {
  it("accepts an email and lowercases it", () => {
    expect(normalizeEmail("")).toEqual({ ok: true, email: null });
    expect(normalizeEmail(" Office@Example.com ")).toEqual({ ok: true, email: "office@example.com" });
  });

  it("rejects an email without a name and a domain", () => {
    expect(normalizeEmail("not-an-email")).toEqual({ ok: false });
    expect(normalizeEmail("office@example")).toEqual({ ok: false });
    expect(normalizeEmail("office @example.com")).toEqual({ ok: false });
    expect(normalizeEmail("@example.com")).toEqual({ ok: false });
  });
});

describe("normalizeWebsite", () => {
  it("accepts http and https links", () => {
    expect(normalizeWebsite("")).toEqual({ ok: true, website: null });
    expect(normalizeWebsite("https://example.com/electrical")).toEqual({
      ok: true,
      website: "https://example.com/electrical",
    });
    expect(normalizeWebsite("http://example.com")).toEqual({
      ok: true,
      website: "http://example.com/",
    });
  });

  it("rejects a missing scheme and non-http schemes", () => {
    expect(normalizeWebsite("example.com")).toEqual({ ok: false });
    expect(normalizeWebsite("javascript:alert(1)")).toEqual({ ok: false });
    expect(normalizeWebsite("ftp://example.com/file")).toEqual({ ok: false });
  });
});

describe("parseCompanyForm", () => {
  it("reports ABN, email, and website errors together", () => {
    const result = parseCompanyForm(
      form({
        name: "Example Electrical Pty Ltd",
        abn: "123",
        address: "",
        phone: "",
        email: "office",
        website: "example.com",
        categoryId: "seed_cat_electrical",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.abn).toBe("Enter an 11-digit ABN.");
      expect(result.errors.email).toBe("Enter a valid email address.");
      expect(result.errors.website).toBe("Enter a valid website link.");
    }
  });
});

describe("contractor categories", () => {
  const existing = [
    { id: "plumbing", name: "Plumbing" },
    { id: "electrical", name: "Electrical" },
  ];

  it("lets an admin or a manager change categories and leaves staff able to view only", () => {
    expect(canManageContractors("admin")).toBe(true);
    expect(canManageContractors("manager")).toBe(true);
    expect(canManageContractors("staff")).toBe(false);
  });

  it("rejects a blank name and a name over 80 characters", () => {
    expect(parseContractorCategoryName("")).toEqual({ ok: false, error: "Enter a category name." });
    expect(parseContractorCategoryName("   ")).toEqual({ ok: false, error: "Enter a category name." });
    expect(parseContractorCategoryName(`  Glass  `)).toEqual({ ok: true, name: "Glass" });
    expect(parseContractorCategoryName("a".repeat(80))).toEqual({ ok: true, name: "a".repeat(80) });
    expect(parseContractorCategoryName("a".repeat(81))).toEqual({
      ok: false,
      error: "Use 80 characters or fewer.",
    });
  });

  it("treats names that differ only by case as duplicates, except the category being renamed", () => {
    expect(contractorCategoryNameTaken("plumbing", existing)).toBe(true);
    expect(contractorCategoryNameTaken("PLUMBING", existing)).toBe(true);
    expect(contractorCategoryNameTaken("Glass", existing)).toBe(false);
    expect(contractorCategoryNameTaken("plumbing", existing, "plumbing")).toBe(false);
  });

  it("blocks removal while contractors still use the category and does not delete them", () => {
    expect(contractorCategoryInUseMessage(0)).toBeNull();
    expect(contractorCategoryInUseMessage(1)).toBe(
      "1 contractor uses this category. Move that contractor to another category before removing it.",
    );
    expect(contractorCategoryInUseMessage(3)).toBe(
      "3 contractors use this category. Move them to another category before removing it.",
    );
    expect(contractorCategoryInUseMessage(1)).not.toMatch(/delete/i);
  });
});

describe("companies with expired insurance", () => {
  const today = new Date("2026-11-17T13:30:00.000Z");

  const companies = [
    { id: "yesterday", insurances: [{ expiresOn: new Date("2026-11-17T00:00:00.000Z") }] },
    { id: "today", insurances: [{ expiresOn: new Date("2026-11-18T00:00:00.000Z") }] },
    { id: "future", insurances: [{ expiresOn: new Date("2028-01-01T00:00:00.000Z") }] },
    { id: "none", insurances: [] },
    {
      id: "mixed",
      insurances: [
        { expiresOn: new Date("2024-05-01T00:00:00.000Z") },
        { expiresOn: new Date("2028-06-30T00:00:00.000Z") },
      ],
    },
  ];

  it("uses the Sydney calendar day as the cutoff", () => {
    expect(expiredInsuranceWhere(today)).toEqual({
      insurances: { some: { expiresOn: { lt: new Date("2026-11-18T00:00:00.000Z") } } },
    });
  });

  it("returns companies with any insurance expiring before today", () => {
    expect(companiesWithExpiredInsurance(companies, today).map((company) => company.id)).toEqual([
      "yesterday",
      "mixed",
    ]);
  });

  it("keeps the list status on the same cutoff", () => {
    expect(insuranceStanding([], today)).toBe("none");
    expect(insuranceStanding([new Date("2026-11-18T00:00:00.000Z")], today)).toBe("current");
    expect(insuranceStanding([new Date("2026-11-17T00:00:00.000Z")], today)).toBe("expired");
  });
});
