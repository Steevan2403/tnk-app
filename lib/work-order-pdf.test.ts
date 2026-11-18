import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildWorkOrderPdf, logoFilePath, logoPaths } from "./work-order-pdf";

describe("work order PDF", () => {
  it("builds a PDF that includes the work order number and the TNK logo", async () => {
    const logoSvg = await readFile(logoFilePath(), "utf8");
    expect(logoPaths(logoSvg).length).toBeGreaterThan(10);

    const pdf = await buildWorkOrderPdf({
      number: "12-A",
      sentAt: new Date("2026-11-18T00:00:00.000Z"),
      buildingName: "Example Tower",
      buildingAddress: "100 Example Street, Sydney NSW 2000",
      companyName: "Fictional Fire Services",
      contactName: "Avery Sample",
      contactEmail: "avery.sample@example.com",
      caseNumber: 12,
      caseSubject: "Example lobby camera quote",
      caseType: "Repair & maintenance",
      jobArea: "Lobby camera 1",
      instructions: "Example quote request for lobby camera 1.",
      purchaseOrderNumber: "PO-EX-1012",
      attendingAt: null,
      accessNotes: "Example: sign in at the desk.",
      attachmentNames: ["example-photo.png"],
      logoSvg,
    });

    const bytes = Buffer.from(pdf);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(2000);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe("Work order 12-A");
    expect(loaded.getPageCount()).toBeGreaterThan(0);
    expect(pdfDraws(bytes, "12-A")).toBe(true);
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
