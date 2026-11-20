import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { CASE_TABLE_HEADERS, type ReportSections, type ReportSummary } from "./reports";
import { logoFilePath, logoPaths } from "./work-order-pdf";

const NAVY = rgb(0, 0, 128 / 255);
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.29, 0.34, 0.39);
const BAR = rgb(0.9, 0.91, 0.93);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const BOTTOM = 52;
const LOGO_WIDTH = 150;

export type ReportPhoto = { name: string; bytes: Uint8Array; kind: "png" | "jpg" };

export type ReportPdfCase = {
  number: number;
  subject: string;
  typeName: string;
  status: string;
  priority: string;
  started: string;
  completed: string;
  contractor: string;
  description: string;
  history: string[];
  jobArea: string;
  photos: ReportPhoto[];
  quotes: string[];
  invoices: string[];
  documents: string[];
  notes: string | null;
  workOrders: string[];
};

export type ReportPdfInspection = {
  name: string;
  completed: string;
  pass: number;
  fail: number;
  na: number;
  unanswered: number;
  failed: { area: string; item: string; comment: string | null }[];
};

export type ManagementReportPdfInput = {
  buildingName: string;
  buildingAddress: string;
  periodLabel: string;
  preparedBy: string;
  preparedOn: string;
  sections: ReportSections;
  summary: ReportSummary;
  cases: ReportPdfCase[];
  visits: { when: string; subject: string; status: string }[];
  inspections: ReportPdfInspection[];
  logoSvg?: string;
};

export async function buildManagementPdf(input: ManagementReportPdfInput): Promise<Uint8Array> {
  const logoSvg = input.logoSvg ?? (await readFile(logoFilePath(), "utf8"));
  const doc = await PDFDocument.create();
  doc.setTitle(`Management report ${pdfSafe(input.periodLabel)}`.slice(0, 180));
  doc.setAuthor("TNK Property Services");
  doc.setSubject(pdfSafe(`${input.buildingName} management report`).slice(0, 180));
  doc.setCreator("TNK Property Services");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const photos = new Map<ReportPhoto, PDFImage | null>();
  if (input.sections.details && input.sections.photos) {
    for (const item of input.cases) {
      for (const photo of item.photos) {
        photos.set(photo, await embedPhoto(doc, photo));
      }
    }
  }

  const sheet = new Sheet(doc, font, bold, input.buildingName);
  sheet.cover(logoSvg, input);
  if (input.sections.summary || input.sections.chart) sheet.summary(input);
  if (input.sections.cases) sheet.caseTable(input.cases);
  if (input.sections.details) {
    for (const item of input.cases) sheet.casePage(item, input.sections, photos);
  }
  if (input.sections.maintenance) sheet.maintenance(input.visits);
  if (input.sections.inspections) sheet.inspections(input.inspections, input.summary);
  sheet.footer();
  return doc.save();
}

async function embedPhoto(doc: PDFDocument, photo: ReportPhoto): Promise<PDFImage | null> {
  try {
    if (photo.kind === "png") return await doc.embedPng(photo.bytes);
    return await doc.embedJpg(photo.bytes);
  } catch {
    return null;
  }
}

class Sheet {
  private page: PDFPage | null = null;
  private y = PAGE_HEIGHT - MARGIN;
  private running = "Management report";

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private building: string,
  ) {}

  cover(logoSvg: string, input: ManagementReportPdfInput) {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
    drawLogo(this.page, logoSvg, MARGIN, this.y, LOGO_WIDTH);
    this.y -= 88;
    this.draw("Management report", 22, true, NAVY);
    this.gap(8);
    this.draw(input.buildingName, 16, true, INK);
    this.draw(input.buildingAddress, 11, false, INK);
    this.gap(16);
    this.labelled("Period", input.periodLabel);
    this.labelled("Prepared by", input.preparedBy);
    this.labelled("Date", input.preparedOn);
  }

  summary(input: ManagementReportPdfInput) {
    this.breakPage(input.sections.summary ? "Summary" : "Cases");
    const summary = input.summary;
    if (input.sections.summary) {
      this.line(`Cases opened: ${summary.opened}`);
      this.line(`Cases completed: ${summary.completed}`);
      this.line(`Cases open: ${summary.open}`);
      this.gap(8);
      this.heading("By type");
      this.countLines(summary.byType);
      this.heading("By status");
      this.countLines(summary.byStatus);
      this.heading("Maintenance");
      this.line(`Done: ${summary.maintenanceDone}`);
      this.line(`Skipped: ${summary.maintenanceSkipped}`);
      this.line(`Overdue: ${summary.maintenanceOverdue}`);
      this.heading("Inspections");
      this.line(`Completed: ${summary.inspectionRuns}`);
      this.line(
        `Pass ${summary.inspectionPass}, fail ${summary.inspectionFail}, not applicable ${summary.inspectionNa}, unanswered ${summary.inspectionUnanswered}`,
      );
    }
    if (input.sections.chart) {
      this.gap(8);
      this.bars("Cases by type", summary.byType);
      this.bars("Cases by status", summary.byStatus);
    }
  }

  caseTable(cases: ReportPdfCase[]) {
    this.breakPage("Cases");
    if (cases.length === 0) {
      this.line("No cases in this report.");
      return;
    }
    const columns = tableColumns();
    this.tableRow(columns.map((column) => column.title), columns, true);
    for (const item of cases) {
      this.tableRow(
        [
          `Case #${item.number}`,
          item.started,
          item.completed,
          item.subject,
          item.typeName,
          item.contractor,
          item.priority,
          item.status,
        ],
        columns,
        false,
      );
    }
  }

  casePage(item: ReportPdfCase, sections: ReportSections, photos: Map<ReportPhoto, PDFImage | null>) {
    this.breakPage(`Case #${item.number}`);
    this.draw(item.subject, 13, true, INK);
    this.gap(6);
    this.labelled("Type", item.typeName);
    this.labelled("Status", item.status);
    this.labelled("Priority", item.priority);
    this.labelled("Started", item.started);
    this.labelled("Completed", item.completed);
    this.labelled("Contractor", item.contractor);
    if (sections.jobArea) this.labelled("Job area", item.jobArea);
    this.heading("Description");
    this.paragraph(item.description || "No description.");
    this.heading("Status history");
    this.paragraph(item.history.length ? item.history.join("\n") : "No status history.");
    this.heading("Work orders");
    this.paragraph(item.workOrders.length ? item.workOrders.join("\n") : "No work orders.");
    if (sections.photos) this.photoBlock(item.photos, photos);
    if (sections.quotes) this.nameList("Quotes", item.quotes);
    if (sections.invoices) this.nameList("Invoices", item.invoices);
    if (sections.documents) this.nameList("Documents", item.documents);
    if (sections.notes) {
      this.heading("Notes");
      this.paragraph(item.notes?.trim() || "No notes.");
    }
  }

  maintenance(visits: { when: string; subject: string; status: string }[]) {
    this.breakPage("Maintenance");
    if (visits.length === 0) {
      this.line("No completed, skipped, or overdue visits in this period.");
      return;
    }
    for (const visit of visits) {
      this.line(`${visit.when}  ${visit.status}`);
      this.paragraph(visit.subject);
      this.gap(4);
    }
  }

  inspections(runs: ReportPdfInspection[], summary: ReportSummary) {
    this.breakPage("Inspections");
    this.line(`${summary.inspectionRuns} completed`);
    this.line(
      `Pass ${summary.inspectionPass}, fail ${summary.inspectionFail}, not applicable ${summary.inspectionNa}, unanswered ${summary.inspectionUnanswered}`,
    );
    if (runs.length === 0) {
      this.gap(6);
      this.line("No inspections were completed in this period.");
      return;
    }
    for (const run of runs) {
      this.heading(run.name);
      this.line(`Completed ${run.completed}`);
      this.line(`Pass ${run.pass}, fail ${run.fail}, not applicable ${run.na}, unanswered ${run.unanswered}`);
      if (run.failed.length === 0) {
        this.line("No failed items.");
        continue;
      }
      this.line("Failed items");
      for (const item of run.failed) {
        const comment = item.comment?.trim() ? ` - ${item.comment.trim()}` : "";
        this.paragraph(`${item.item} (${item.area})${comment}`);
      }
    }
  }

  footer() {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((page, index) => {
      const label = `Page ${index + 1} of ${total}`;
      page.drawText("TNK Property Services", { x: MARGIN, y: 28, size: 9, font: this.font, color: MUTED });
      const width = this.font.widthOfTextAtSize(label, 9);
      page.drawText(label, { x: PAGE_WIDTH - MARGIN - width, y: 28, size: 9, font: this.font, color: MUTED });
    });
  }

  private photoBlock(list: ReportPhoto[], photos: Map<ReportPhoto, PDFImage | null>) {
    this.heading("Photos");
    if (list.length === 0) {
      this.line("No photos.");
      return;
    }
    for (const photo of list) {
      const image = photos.get(photo);
      if (image) this.image(image);
      this.note(photo.name);
    }
  }

  private nameList(title: string, names: string[]) {
    this.heading(title);
    this.paragraph(names.length ? names.join("\n") : "None.");
  }

  private bars(title: string, rows: { label: string; count: number }[]) {
    this.heading(title);
    if (rows.length === 0) {
      this.line("None.");
      return;
    }
    const max = Math.max(...rows.map((row) => row.count), 1);
    const maxWidth = 160;
    for (const row of rows) {
      this.ensure(18);
      const page = this.page;
      if (!page) return;
      const label = clip(`${row.label}  ${row.count}`, this.font, 9, 220);
      page.drawText(label, { x: MARGIN, y: this.y - 9, size: 9, font: this.font, color: INK });
      const width = Math.max(2, (row.count / max) * maxWidth);
      page.drawRectangle({ x: MARGIN + 230, y: this.y - 11, width: maxWidth, height: 8, color: BAR });
      page.drawRectangle({ x: MARGIN + 230, y: this.y - 11, width, height: 8, color: NAVY });
      this.y -= 16;
    }
  }

  private countLines(rows: { label: string; count: number }[]) {
    if (rows.length === 0) {
      this.line("None.");
      return;
    }
    for (const row of rows) this.line(`${row.label}: ${row.count}`);
  }

  private tableRow(values: string[], columns: { title: string; width: number }[], header: boolean) {
    this.ensure(14);
    const page = this.page;
    if (!page) return;
    let x = MARGIN;
    values.forEach((value, index) => {
      const width = columns[index]?.width ?? 40;
      const text = clip(value, header ? this.bold : this.font, 8, width - 4);
      page.drawText(text, { x, y: this.y - 8, size: 8, font: header ? this.bold : this.font, color: header ? NAVY : INK });
      x += width;
    });
    this.y -= 12;
  }

  private labelled(label: string, value: string) {
    this.draw(label, 9, true, MUTED);
    this.paragraph(value);
    this.gap(4);
  }

  private heading(value: string) {
    this.gap(6);
    this.draw(value, 12, true, NAVY);
    this.gap(2);
  }

  private line(value: string) {
    this.draw(value, 10, false, INK);
  }

  private note(value: string) {
    this.draw(value, 9, false, MUTED);
  }

  private paragraph(value: string) {
    const lines = wrap(pdfSafe(value), this.font, 10, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) this.draw(line, 10, false, INK);
  }

  private draw(value: string, size: number, strong: boolean, color: ReturnType<typeof rgb>) {
    const font = strong ? this.bold : this.font;
    const lines = wrap(pdfSafe(value), font, size, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      this.ensure(size + 4);
      this.page?.drawText(line.length ? line : " ", { x: MARGIN, y: this.y - size, size, font, color });
      this.y -= size + 3;
    }
  }

  private image(image: PDFImage) {
    const maxWidth = 180;
    const maxHeight = 110;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensure(height + 6);
    this.page?.drawImage(image, { x: MARGIN, y: this.y - height, width, height });
    this.y -= height + 4;
  }

  private gap(amount: number) {
    this.y -= amount;
  }

  private rule() {
    const page = this.page;
    if (!page) return;
    page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: NAVY,
    });
    this.y -= 12;
  }

  private breakPage(title: string) {
    this.running = title;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
    this.draw(title, 16, true, NAVY);
    this.draw(this.building, 10, false, MUTED);
    this.rule();
  }

  private ensure(height: number) {
    if (this.page && this.y - height >= BOTTOM) return;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
    this.draw(this.running, 11, true, NAVY);
    this.y -= 4;
  }
}

const CASE_WIDTHS = [58, 62, 64, 100, 68, 72, 48, 43];

function tableColumns(): { title: string; width: number }[] {
  return CASE_TABLE_HEADERS.map((title, index) => ({ title, width: CASE_WIDTHS[index] ?? 40 }));
}

function drawLogo(page: PDFPage, svg: string, x: number, top: number, width: number) {
  const scale = width / 407;
  for (const item of logoPaths(svg)) {
    page.drawSvgPath(item.d, {
      x: x + item.x * scale,
      y: top - item.y * scale,
      scale,
      color: NAVY,
    });
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => breakWord(word, font, size, width));
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) current = next;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function breakWord(word: string, font: PDFFont, size: number, width: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= width) return [word];
  const parts: string[] = [];
  let current = "";
  for (const char of word) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= width) current = next;
    else {
      if (current) parts.push(current);
      current = char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function clip(value: string, font: PDFFont, size: number, width: number): string {
  const safe = pdfSafe(value).replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(safe, size) <= width) return safe || " ";
  let end = safe.length;
  while (end > 1 && font.widthOfTextAtSize(`${safe.slice(0, end)}...`, size) > width) end -= 1;
  return `${safe.slice(0, end)}...`;
}

function pdfSafe(value: string): string {
  return value.replace(/[^\n\r\t\x20-\x7E]/g, "?");
}
