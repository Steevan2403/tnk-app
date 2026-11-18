import { describe, expect, it } from "vitest";
import {
  companiesWithExpiredInsurance,
  expiredInsuranceWhere,
  insuranceStanding,
  normalizeAbn,
  normalizeEmail,
  normalizeWebsite,
  parseCompanyForm,
} from "./contractors";

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
