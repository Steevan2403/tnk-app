import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Tab,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import type { ManagementReportPdfInput, ReportPdfCase, ReportPdfInspection, ReportPhoto } from "./report-pdf";
import { CASE_TABLE_HEADERS, type ReportSections } from "./reports";
import { logoFilePath } from "./work-order-pdf";

const NAVY = "000080";
const INK = "1F2938";
const MUTED = "4A5763";
const LINE = "D5D8DE";
const HEADER_FILL = "E6E7ED";
const LOGO_WIDTH = 150;
const CASE_WIDTHS = [1100, 1180, 1220, 1500, 1240, 1360, 760, 1940];
const TABLE_WIDTH = CASE_WIDTHS.reduce((sum, width) => sum + width, 0);
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };

type Block = Paragraph | Table;

export async function buildManagementDocx(input: ManagementReportPdfInput): Promise<Uint8Array> {
  const logoSvg = input.logoSvg ?? (await readFile(logoFilePath(), "utf8"));
  const logoPng = await readFile(logoPngPath());
  const logoHeight = logoHeightFor(logoPng);
  const blocks: Block[] = [];
  blocks.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new ImageRun({
          type: "svg",
          data: Buffer.from(logoSvg),
          transformation: { width: LOGO_WIDTH, height: logoHeight },
          fallback: { type: "png", data: logoPng },
          altText: { name: "TNK", title: "TNK Property Services", description: "TNK Property Services" },
        }),
      ],
    }),
  );
  blocks.push(heading("Management report", 44));
  blocks.push(heading(input.buildingName, 32, INK));
  blocks.push(body(input.buildingAddress, 22));
  blocks.push(...labelled("Period", input.periodLabel));
  blocks.push(...labelled("Prepared by", input.preparedBy));
  blocks.push(...labelled("Date", input.preparedOn));

  if (input.sections.summary || input.sections.chart) summary(blocks, input);
  if (input.sections.cases) cases(blocks, input);
  if (input.sections.details) {
    for (const item of input.cases) caseDetail(blocks, item, input.buildingName, input.sections);
  }
  if (input.sections.maintenance) maintenance(blocks, input);
  if (input.sections.inspections) inspections(blocks, input);

  const doc = new Document({
    title: `Management report ${input.periodLabel}`.slice(0, 180),
    creator: "TNK Property Services",
    subject: `${input.buildingName} management report`.slice(0, 180),
    features: { updateFields: true },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 800, right: 803, bottom: 900, left: 803, header: 360, footer: 420 },
          },
        },
        footers: { default: footer() },
        children: blocks,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

function summary(blocks: Block[], input: ManagementReportPdfInput) {
  sectionTitle(blocks, input.sections.summary ? "Summary" : "Cases", input.buildingName);
  const summary = input.summary;
  if (input.sections.summary) {
    blocks.push(body(`Cases opened: ${summary.opened}`));
    blocks.push(body(`Cases completed: ${summary.completed}`));
    blocks.push(body(`Cases open: ${summary.open}`));
    blocks.push(subhead("By type"));
    countLines(blocks, summary.byType);
    blocks.push(subhead("By status"));
    countLines(blocks, summary.byStatus);
    blocks.push(subhead("Maintenance"));
    blocks.push(body(`Done: ${summary.maintenanceDone}`));
    blocks.push(body(`Skipped: ${summary.maintenanceSkipped}`));
    blocks.push(body(`Overdue: ${summary.maintenanceOverdue}`));
    blocks.push(subhead("Inspections"));
    blocks.push(body(`Completed: ${summary.inspectionRuns}`));
    blocks.push(body(inspectionLine(summary)));
  }
  if (input.sections.chart) {
    blocks.push(subhead("Cases by type"));
    countLines(blocks, summary.byType);
    blocks.push(subhead("Cases by status"));
    countLines(blocks, summary.byStatus);
  }
}

function cases(blocks: Block[], input: ManagementReportPdfInput) {
  sectionTitle(blocks, "Cases", input.buildingName);
  if (input.cases.length === 0) {
    blocks.push(body("No cases in this report."));
    return;
  }
  blocks.push(caseTable(input.cases));
}

function caseDetail(blocks: Block[], item: ReportPdfCase, building: string, sections: ReportSections) {
  sectionTitle(blocks, `Case #${item.number}`, building);
  blocks.push(heading(item.subject, 26, INK));
  blocks.push(...labelled("Type", item.typeName));
  blocks.push(...labelled("Status", item.status));
  blocks.push(...labelled("Priority", item.priority));
  blocks.push(...labelled("Started", item.started));
  blocks.push(...labelled("Completed", item.completed));
  blocks.push(...labelled("Contractor", item.contractor));
  if (sections.jobArea) blocks.push(...labelled("Job area", item.jobArea));
  blocks.push(subhead("Description"));
  blocks.push(...lines(item.description || "No description."));
  blocks.push(subhead("Status history"));
  blocks.push(...lines(item.history.length ? item.history.join("\n") : "No status history."));
  blocks.push(subhead("Work orders"));
  if (item.workOrders.length === 0) blocks.push(body("No work orders."));
  else blocks.push(workOrderTable(item.workOrders));
  if (sections.photos) {
    blocks.push(subhead("Photos"));
    blocks.push(...photoBlocks(item.photos));
  }
  if (sections.quotes) nameList(blocks, "Quotes", item.quotes);
  if (sections.invoices) nameList(blocks, "Invoices", item.invoices);
  if (sections.documents) nameList(blocks, "Documents", item.documents);
  if (sections.notes) {
    blocks.push(subhead("Notes"));
    blocks.push(...lines(item.notes?.trim() || "No notes."));
  }
}

function maintenance(blocks: Block[], input: ManagementReportPdfInput) {
  sectionTitle(blocks, "Maintenance", input.buildingName);
  if (input.visits.length === 0) {
    blocks.push(body("No completed, skipped, or overdue visits in this period."));
    return;
  }
  for (const visit of input.visits) {
    blocks.push(body(`${visit.when}  ${visit.status}`));
    blocks.push(...lines(visit.subject));
  }
}

function inspections(blocks: Block[], input: ManagementReportPdfInput) {
  sectionTitle(blocks, "Inspections", input.buildingName);
  const summary = input.summary;
  blocks.push(body(`${summary.inspectionRuns} completed`));
  blocks.push(body(inspectionLine(summary)));
  if (input.inspections.length === 0) {
    blocks.push(body("No inspections were completed in this period."));
    return;
  }
  for (const run of input.inspections) inspectionRun(blocks, run);
}

function inspectionRun(blocks: Block[], run: ReportPdfInspection) {
  blocks.push(subhead(run.name));
  blocks.push(body(`Completed ${run.completed}`));
  blocks.push(body(`Pass ${run.pass}, fail ${run.fail}, not applicable ${run.na}, unanswered ${run.unanswered}`));
  if (run.failed.length === 0) {
    blocks.push(body("No failed items."));
    return;
  }
  blocks.push(body("Failed items"));
  for (const item of run.failed) {
    const comment = item.comment?.trim() ? ` - ${item.comment.trim()}` : "";
    blocks.push(...lines(`${item.item} (${item.area})${comment}`));
  }
}

function caseTable(cases: ReportPdfCase[]): Table {
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: CASE_WIDTHS,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: CASE_TABLE_HEADERS.map((title, index) => cell(title, CASE_WIDTHS[index], true)),
      }),
      ...cases.map(
        (item) =>
          new TableRow({
            cantSplit: true,
            children: caseValues(item).map((value, index) => cell(value, CASE_WIDTHS[index], false)),
          }),
      ),
    ],
  });
}

function workOrderTable(orders: string[]): Table {
  const widths = [2200, 5200, 2900];
  const headers = ["Work order", "Contractor", "Status"];
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((title, index) => cell(title, widths[index], true)),
      }),
      ...orders.map((order) => {
        const parts = order.split(" - ");
        const values = [parts[0] ?? order, parts[1] ?? "", parts.slice(2).join(" - ")];
        return new TableRow({
          cantSplit: true,
          children: values.map((value, index) => cell(value, widths[index], false)),
        });
      }),
    ],
  });
}

function photoBlocks(photos: ReportPhoto[]): Block[] {
  if (photos.length === 0) return [body("No photos.")];
  const blocks: Block[] = [];
  for (const photo of photos) {
    blocks.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new ImageRun({
            type: photo.kind === "jpg" ? "jpg" : "png",
            data: photo.bytes,
            transformation: fit(photo),
            altText: { name: photo.name, title: photo.name, description: photo.name },
          }),
        ],
      }),
    );
    blocks.push(body(photo.name, 18, MUTED));
  }
  return blocks;
}

function nameList(blocks: Block[], title: string, names: string[]) {
  blocks.push(subhead(title));
  blocks.push(...lines(names.length ? names.join("\n") : "None."));
}

function countLines(blocks: Block[], rows: { label: string; count: number }[]) {
  if (rows.length === 0) {
    blocks.push(body("None."));
    return;
  }
  for (const row of rows) blocks.push(body(`${row.label}: ${row.count}`));
}

function inspectionLine(summary: ManagementReportPdfInput["summary"]): string {
  return `Pass ${summary.inspectionPass}, fail ${summary.inspectionFail}, not applicable ${summary.inspectionNa}, unanswered ${summary.inspectionUnanswered}`;
}

function caseValues(item: ReportPdfCase): string[] {
  return [
    `Case #${item.number}`,
    item.started,
    item.completed,
    item.subject,
    item.typeName,
    item.contractor,
    item.priority,
    item.status,
  ];
}

function sectionTitle(blocks: Block[], title: string, building: string) {
  blocks.push(
    new Paragraph({
      pageBreakBefore: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 1 } },
      spacing: { after: 80 },
      children: [run(title, { bold: true, size: 32, color: NAVY })],
    }),
  );
  blocks.push(body(building, 20, MUTED));
}

function footer(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TABLE_WIDTH }],
        children: [
          run("TNK Property Services", { size: 18, color: MUTED }),
          new TextRun({
            children: [new Tab(), "Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
            font: "Calibri",
            size: 18,
            color: MUTED,
          }),
        ],
      }),
    ],
  });
}

function labelled(label: string, value: string): Paragraph[] {
  return [body(label, 18, MUTED, true), ...lines(value)];
}

function subhead(value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [run(value, { bold: true, size: 24, color: NAVY })],
  });
}

function heading(value: string, size: number, color = NAVY): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [run(value, { bold: true, size, color })],
  });
}

function lines(value: string): Paragraph[] {
  const parts = value.split("\n");
  return (parts.length ? parts : [""]).map((line) => body(line));
}

function body(value: string, size = 20, color = INK, bold = false): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [run(value, { bold, size, color })],
  });
}

function run(value: string, options: { bold?: boolean; size: number; color: string }): TextRun {
  return new TextRun({
    text: value.length ? value : " ",
    bold: options.bold,
    size: options.size,
    color: options.color,
    font: "Calibri",
  });
}

function cell(value: string, width: number, header: boolean): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: thin, bottom: thin, left: thin, right: thin },
    shading: header ? { fill: HEADER_FILL } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        children: [run(value, { bold: header, size: 16, color: header ? NAVY : INK })],
      }),
    ],
  });
}

function fit(photo: ReportPhoto): { width: number; height: number } {
  const maxWidth = 180;
  const maxHeight = 110;
  const size = photo.kind === "png" ? pngSize(photo.bytes) : jpegSize(photo.bytes);
  if (!size || size.width < 1 || size.height < 1) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

function logoHeightFor(png: Buffer): number {
  const size = pngSize(png);
  if (!size || size.width < 1) return 46;
  return Math.max(1, Math.round((LOGO_WIDTH * size.height) / size.width));
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: readUint16(bytes, offset + 5), width: readUint16(bytes, offset + 7) };
    }
    const length = readUint16(bytes, offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function logoPngPath(): string {
  return path.join(process.cwd(), "public", "brand", "tnk-logo-navy.png");
}
