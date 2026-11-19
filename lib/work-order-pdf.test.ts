import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildWorkOrderPdf, logoFilePath, logoPaths, type WorkOrderPdfInput } from "./work-order-pdf";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function input(overrides: Partial<WorkOrderPdfInput> = {}): WorkOrderPdfInput {
  return {
    number: "12-A",
    companyName: "TNK Property Services Pty Ltd",
    buildingLine: "Example Tower - SP 10048",
    buildingAddress: "100 Example Street, Sydney NSW 2000",
    siteContactName: "Alex Example",
    siteContactMobile: "0400 000 001",
    siteContactEmail: "site.tower@example.com",
    viewUrl: "https://app.example/work-orders/wo-1",
    checkInUrl: "https://app.example/check-in/seed-check-in-12-a-example",
    dateRequested: "1 Oct 2026",
    dueBy: "8 Oct 2026",
    priority: "High",
    assignedContractor: "Fictional Fire Services | Avery Sample | 0400 000 501",
    subject: "Example lobby camera quote",
    description: "Example quote request for lobby camera 1.\nSecond example line.",
    jobArea: "Lobby",
    assets: "Lobby camera 1",
    photos: [],
    terms: "1. Example authorisation is required.\n2. Example invoices go to accounts@example.com.",
    ...overrides,
  };
}

describe("work order PDF", () => {
  it("builds a PDF that includes the work order number and the TNK logo", async () => {
    const logoSvg = await readFile(logoFilePath(), "utf8");
    expect(logoPaths(logoSvg).length).toBeGreaterThan(10);

    const pdf = await buildWorkOrderPdf(input({ logoSvg, photos: [{ name: "example-photo.png", bytes: png }] }));
    const bytes = Buffer.from(pdf);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(2000);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe("Work order 12-A");
    expect(loaded.getPageCount()).toBe(1);
    const inflated = inflatePdf(bytes);
    expect(inflated).toContain("https://app.example/work-orders/wo-1");
    expect(inflated).toContain("/check-in/seed-check-in-12-a-example");
    expect(inflated.includes("checkin=1")).toBe(false);
    expect(inflated).toContain("mailto:site.tower@example.com");
    expect(pdfDraws(bytes, "WORK ORDER #12-A")).toBe(true);
    expect(pdfDraws(bytes, "Date Requested")).toBe(true);
    expect(pdfDraws(bytes, "Due By")).toBe(true);
    expect(pdfDraws(bytes, "Priority")).toBe(true);
    expect(pdfDraws(bytes, "Assigned Contractor")).toBe(true);
    expect(pdfDraws(bytes, "Job Information")).toBe(true);
    expect(pdfDraws(bytes, "Second example line.")).toBe(true);
    expect(pdfDraws(bytes, "Terms & Conditions")).toBe(true);
    expect(pdfDraws(bytes, "1. Example authorisation is required.")).toBe(true);
  });

  it("omits terms when they are blank and flows long text onto another page", async () => {
    const blank = await buildWorkOrderPdf(input({ terms: "  \n" }));
    expect(pdfDraws(Buffer.from(blank), "Terms & Conditions")).toBe(false);

    const terms = Array.from({ length: 80 }, (_, index) => `${index + 1}. Example term line for page flow ${index + 1}.`).join("\n");
    const description = Array.from({ length: 40 }, (_, index) => `Example description line ${index + 1}.`).join("\n");
    const pdf = await buildWorkOrderPdf(input({ terms, description }));
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
    const bytes = Buffer.from(pdf);
    expect(pdfDraws(bytes, "Terms & Conditions")).toBe(true);
    expect(pdfDraws(bytes, "Example term line for page flow 1.")).toBe(true);
    expect(pdfDraws(bytes, "Example term line for page flow 80.")).toBe(true);
    expect(pdfDraws(bytes, "Example description line 40.")).toBe(true);
  });
});

function pdfDraws(bytes: Buffer, value: string): boolean {
  const hex = Buffer.from(value, "latin1").toString("hex").toUpperCase();
  return inflatePdf(bytes).toUpperCase().includes(hex);
}

function inflatePdf(bytes: Buffer): string {
  const source = bytes.toString("latin1");
  const parts: string[] = [];
  const marker = /(?<!d)stream\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(source))) {
    const start = match.index + match[0].length;
    const end = source.indexOf("\nendstream", start);
    if (end < 0) continue;
    try {
      parts.push(inflateSync(Buffer.from(source.slice(start, end), "latin1")).toString("latin1"));
    } catch {
      // Skip streams that are not flate-compressed page content.
    }
  }
  return parts.join("\n");
}
