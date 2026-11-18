import { inflateSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildManagementPdf } from "./report-pdf";
import { buildManagementXlsx } from "./report-xlsx";
import {
  defaultSections,
  inspectionsInPeriod,
  lastQuarterPeriod,
  monthPeriod,
  reportVisits,
  selectReportCases,
  summariseReport,
  type ReportCase,
  type ReportSelection,
} from "./reports";
import { logoFilePath } from "./work-order-pdf";

const from = new Date("2026-11-01T00:00:00.000Z");
const to = new Date("2026-11-30T00:00:00.000Z");

function item(overrides: Partial<ReportCase> & Pick<ReportCase, "id" | "number" | "startDate">): ReportCase {
  return {
    subject: `Case ${overrides.number}`,
    typeId: "repair",
    typeName: "Repair & maintenance",
    status: "new",
    priority: "low",
    includeInReport: true,
    companyIds: [],
    assetIds: [],
    apartmentId: null,
    ...overrides,
  };
}

function selection(overrides: Partial<ReportSelection> = {}): ReportSelection {
  return {
    from,
    to,
    includeOpen: false,
    typeIds: [],
    statuses: [],
    companyIds: [],
    priorities: [],
    assetIds: [],
    apartmentIds: [],
    excludedIds: [],
    ...overrides,
  };
}

describe("report case selection", () => {
  const cases = [
    item({ id: "in", number: 8, startDate: new Date("2026-11-12T00:00:00.000Z"), status: "in_progress", priority: "urgent", companyIds: ["fire"], assetIds: ["pump"], apartmentId: null }),
    item({ id: "edge", number: 9, startDate: to, status: "completed", typeId: "clean", typeName: "Cleaning", priority: "low" }),
    item({ id: "before-open", number: 1, startDate: new Date("2026-10-01T00:00:00.000Z"), status: "in_progress", companyIds: ["fire"], assetIds: ["pump"] }),
    item({ id: "before-closed", number: 5, startDate: new Date("2026-07-01T00:00:00.000Z"), status: "completed", typeId: "clean", typeName: "Cleaning" }),
    item({ id: "after", number: 20, startDate: new Date("2026-12-01T00:00:00.000Z"), status: "new" }),
    item({ id: "flag", number: 15, startDate: new Date("2026-11-16T00:00:00.000Z"), includeInReport: false, apartmentId: "apt-101" }),
    item({ id: "apt", number: 3, startDate: new Date("2026-11-10T00:00:00.000Z"), typeId: "move", typeName: "Moving in", priority: "medium", apartmentId: "apt-101", status: "new" }),
  ];

  it("keeps cases that started in the period", () => {
    const numbers = selectReportCases(cases, selection()).map((row) => row.number);
    expect(numbers).toEqual([3, 8, 9]);
  });

  it("includes earlier open cases only when the toggle is on", () => {
    expect(selectReportCases(cases, selection({ includeOpen: false })).map((row) => row.id)).not.toContain("before-open");
    const open = selectReportCases(cases, selection({ includeOpen: true })).map((row) => row.id);
    expect(open).toContain("before-open");
    expect(open).not.toContain("before-closed");
    expect(open).not.toContain("after");
  });

  it("applies type, status, contractor, priority, asset, and apartment filters together", () => {
    expect(selectReportCases(cases, selection({ typeIds: ["repair"] })).map((row) => row.number)).toEqual([8]);
    expect(selectReportCases(cases, selection({ statuses: ["completed"] })).map((row) => row.number)).toEqual([9]);
    expect(selectReportCases(cases, selection({ companyIds: ["fire"] })).map((row) => row.number)).toEqual([8]);
    expect(selectReportCases(cases, selection({ priorities: ["medium"] })).map((row) => row.number)).toEqual([3]);
    expect(selectReportCases(cases, selection({ assetIds: ["pump"] })).map((row) => row.number)).toEqual([8]);
    expect(selectReportCases(cases, selection({ apartmentIds: ["apt-101"] })).map((row) => row.number)).toEqual([3]);
    expect(
      selectReportCases(cases, selection({ typeIds: ["repair"], priorities: ["low"] })).map((row) => row.number),
    ).toEqual([]);
  });

  it("drops cases that are not flagged for the report", () => {
    expect(selectReportCases(cases, selection()).map((row) => row.id)).not.toContain("flag");
  });

  it("drops unticked rows", () => {
    const numbers = selectReportCases(cases, selection({ excludedIds: ["in"] })).map((row) => row.number);
    expect(numbers).toEqual([3, 9]);
  });
});

describe("report summary", () => {
  it("counts opened, completed, and open cases, plus maintenance and inspections", () => {
    const summary = summariseReport({
      from,
      to,
      cases: [
        { startDate: new Date("2026-11-12T00:00:00.000Z"), status: "new", typeName: "Repair & maintenance" },
        { startDate: new Date("2026-11-02T00:00:00.000Z"), status: "completed", typeName: "Repair & maintenance" },
        { startDate: new Date("2026-10-01T00:00:00.000Z"), status: "in_progress", typeName: "Cleaning" },
      ],
      visits: [{ status: "completed" }, { status: "skipped" }, { status: "overdue" }, { status: "overdue" }],
      runs: [{ items: [{ result: "pass" }, { result: "fail" }, { result: "na" }, { result: null }] }],
    });
    expect(summary.opened).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.open).toBe(2);
    expect(summary.byType).toEqual([
      { label: "Repair & maintenance", count: 2 },
      { label: "Cleaning", count: 1 },
    ]);
    expect(summary.byStatus.map((row) => row.label)).toEqual(["New", "In progress", "Completed"]);
    expect(summary.maintenanceDone).toBe(1);
    expect(summary.maintenanceSkipped).toBe(1);
    expect(summary.maintenanceOverdue).toBe(2);
    expect(summary.inspectionRuns).toBe(1);
    expect(summary.inspectionPass).toBe(1);
    expect(summary.inspectionFail).toBe(1);
    expect(summary.inspectionNa).toBe(1);
    expect(summary.inspectionUnanswered).toBe(1);
  });
});

describe("report period helpers", () => {
  const today = new Date("2026-11-18T02:00:00.000Z");

  it("uses Sydney calendar months and the previous quarter", () => {
    expect(monthPeriod(today, 0)).toEqual({
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-30T00:00:00.000Z"),
    });
    expect(monthPeriod(today, -1)).toEqual({
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-10-31T00:00:00.000Z"),
    });
    expect(lastQuarterPeriod(today)).toEqual({
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-09-30T00:00:00.000Z"),
    });
  });

  it("lists maintenance visits in the period and completed inspections", () => {
    const visits = reportVisits(
      [
        {
          subject: "Example weekly",
          schedule: { startDate: new Date("2026-11-01T00:00:00.000Z"), endDate: null, frequency: "weekly", intervalMonths: null },
          records: [{ occursOn: new Date("2026-11-01T00:00:00.000Z"), state: "skipped" }],
        },
        {
          subject: "Example monthly",
          schedule: { startDate: new Date("2026-11-02T00:00:00.000Z"), endDate: null, frequency: "monthly", intervalMonths: null },
          records: [{ occursOn: new Date("2026-11-02T00:00:00.000Z"), state: "completed" }],
        },
      ],
      from,
      to,
      new Date("2026-11-18T00:00:00.000Z"),
    );
    expect(visits.filter((visit) => visit.status === "completed")).toHaveLength(1);
    expect(visits.filter((visit) => visit.status === "skipped")).toHaveLength(1);
    expect(visits.filter((visit) => visit.status === "overdue")).toHaveLength(2);
    expect(visits.some((visit) => visit.occursOn.getTime() === new Date("2026-11-22T00:00:00.000Z").getTime())).toBe(false);

    const runs = inspectionsInPeriod(
      [
        { id: "oct", status: "completed", completedAt: new Date("2026-10-20T04:00:00.000Z") },
        { id: "nov", status: "completed", completedAt: new Date("2026-11-02T03:00:00.000Z") },
        { id: "open", status: "in_progress", completedAt: null },
      ],
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-10-31T00:00:00.000Z"),
    );
    expect(runs.map((run) => run.id)).toEqual(["oct"]);
  });
});

describe("report files", () => {
  const cases = [
    item({ id: "keep-8", number: 8, startDate: new Date("2026-11-12T00:00:00.000Z"), subject: "Example hot water leak" }),
    item({ id: "drop-12", number: 12, startDate: new Date("2026-11-08T00:00:00.000Z"), subject: "Example lobby camera quote" }),
    item({ id: "keep-11", number: 11, startDate: new Date("2026-11-15T00:00:00.000Z"), subject: "Example switchboard check" }),
  ];

  it("builds a valid PDF and workbook that contain the ticked case numbers", async () => {
    const selected = selectReportCases(cases, selection({ excludedIds: ["drop-12"] }));
    expect(selected.map((row) => row.number)).toEqual([8, 11]);
    const logoSvg = await readFile(logoFilePath(), "utf8");
    const summary = summariseReport({ cases: selected, from, to, visits: [], runs: [] });
    const sections = defaultSections();
    const pdfCases = selected.map((row) => ({
      number: row.number,
      subject: row.subject,
      typeName: row.typeName,
      status: "New",
      priority: "Low",
      started: "12 Nov 2026",
      completed: "-",
      contractor: "None",
      description: "Example description.",
      history: ["18 Nov 2026, 12:00 pm - Case created."],
      jobArea: "Not applicable",
      photos: [],
      quotes: [],
      invoices: [],
      documents: [],
      notes: null,
      workOrders: [],
    }));
    const pdf = await buildManagementPdf({
      buildingName: "Example Tower",
      buildingAddress: "100 Example Street, Sydney NSW 2000",
      periodLabel: "1 Nov 2026 to 30 Nov 2026",
      preparedBy: "Example Admin",
      preparedOn: "18 Nov 2026, 5:00 pm",
      sections,
      summary,
      cases: pdfCases,
      visits: [{ when: "2 Nov 2026", subject: "Example pump service", status: "Completed" }],
      inspections: [],
      logoSvg,
    });
    const pdfBytes = Buffer.from(pdf);
    expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
    const loaded = await PDFDocument.load(pdfBytes);
    expect(loaded.getPageCount()).toBeGreaterThan(2);
    expect(pdfHas(pdfBytes, "Case #8")).toBe(true);
    expect(pdfHas(pdfBytes, "Case #11")).toBe(true);
    expect(pdfHas(pdfBytes, "Case #12")).toBe(false);

    const xlsx = await buildManagementXlsx({
      cases: selected.map((row) => ({
        number: row.number,
        started: "12 Nov 2026",
        completed: "-",
        subject: row.subject,
        typeName: row.typeName,
        contractor: "None",
        priority: "Low",
        status: "New",
      })),
      visits: [{ when: "2 Nov 2026", subject: "Example pump service", status: "Completed" }],
    });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(xlsx) as unknown as Parameters<typeof book.xlsx.load>[0]);
    const sheet = book.getWorksheet("Cases");
    const maintenance = book.getWorksheet("Maintenance");
    expect(sheet).toBeTruthy();
    expect(maintenance).toBeTruthy();
    const numbers = sheet!.getColumn(1).values.slice(1).map((value) => String(value ?? ""));
    expect(numbers).toContain("8");
    expect(numbers).toContain("11");
    expect(numbers).not.toContain("12");
    expect(maintenance!.getCell("B2").value).toBe("Example pump service");
  });
});

function pdfHas(bytes: Buffer, value: string): boolean {
  const text = inflatePdf(bytes);
  if (text.includes(value)) return true;
  const hex = Buffer.from(value, "latin1").toString("hex");
  return text.toUpperCase().includes(hex.toUpperCase());
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
