import { describe, expect, it } from "vitest";
import {
  assignedContractorLine,
  buildingLine,
  decideCompanySettingsSave,
  siteContactValue,
  workOrderFileUrl,
  workOrderLinks,
} from "./work-order-terms";

const typed = [
  "1. Do not start the work until this work order has been authorised.",
  "",
  "2. Stop and tell the site contact about damage before extra work.",
  "3. Follow the laws that apply, and keep current insurance.",
  "4. Send the invoice to accounts@example.com.",
].join("\n");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("work order terms save", () => {
  it("keeps numbering and line breaks for an admin or a manager", () => {
    for (const role of ["admin", "manager"]) {
      const result = decideCompanySettingsSave(role, form({ companyName: "  ", workOrderTerms: typed }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.companyName).toBe("TNK Property Services Pty Ltd");
        expect(result.value.workOrderTerms).toBe(typed);
      }
    }
  });

  it("refuses a save from staff", () => {
    const result = decideCompanySettingsSave("staff", form({ companyName: "TNK Property Services Pty Ltd", workOrderTerms: typed }));
    expect(result).toEqual({ ok: false, error: "You do not have permission to edit work order terms." });
  });

  it("stores an empty terms value when the box is blank", () => {
    const result = decideCompanySettingsSave("admin", form({ companyName: "Example Co", workOrderTerms: "  \n  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.workOrderTerms).toBe("");
  });
});

describe("work order contact details", () => {
  it("uses the building site contact and falls back to company settings", () => {
    expect(siteContactValue("Alex Example", "Office Example")).toBe("Alex Example");
    expect(siteContactValue("  ", "Office Example")).toBe("Office Example");
    expect(siteContactValue(null, "  ")).toBe("");
  });

  it("prints the strata plan and leaves the building name alone when there is no plan", () => {
    expect(buildingLine("Example Tower", "SP 10048")).toBe("Example Tower - SP 10048");
    expect(buildingLine("Sample Court", null)).toBe("Sample Court");
    expect(buildingLine("Sample Court", "  ")).toBe("Sample Court");
  });

  it("joins the contractor company, contact, and phone", () => {
    expect(assignedContractorLine("Example Contractor", "Avery Sample", "0400 000 501")).toBe(
      "Example Contractor | Avery Sample | 0400 000 501",
    );
  });

  it("links check-in to the private token page", () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://app.example";
    try {
      const links = workOrderLinks("work-order-1", "seed-check-in-300-a-example");
      expect(links.viewUrl).toBe("https://app.example/work-orders/work-order-1");
      expect(links.checkInUrl).toBe("https://app.example/check-in/seed-check-in-300-a-example");
      expect(workOrderFileUrl("seed-check-in-300-a-example", "file 1")).toBe(
        "https://app.example/api/work-order-files/seed-check-in-300-a-example/file%201",
      );
    } finally {
      if (previous === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previous;
    }
  });
});
