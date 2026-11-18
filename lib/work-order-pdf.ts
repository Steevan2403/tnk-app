import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDateTime } from "./contractors";

const NAVY = rgb(0, 0, 128 / 255);
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.29, 0.34, 0.39);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LOGO_WIDTH = 150;

export type WorkOrderPdfInput = {
  number: string;
  sentAt: Date;
  buildingName: string;
  buildingAddress: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  caseNumber: number;
  caseSubject: string;
  caseType: string;
  jobArea: string;
  instructions: string;
  purchaseOrderNumber: string | null;
  attendingAt: Date | null;
  accessNotes: string | null;
  attachmentNames: string[];
  logoSvg?: string;
};

type LogoPath = { d: string; x: number; y: number };

export function logoFilePath(): string {
  return path.join(process.cwd(), "public", "brand", "tnk-logo-navy.svg");
}

export function logoPaths(svg: string): LogoPath[] {
  const body = svg.replace(/<defs[\s\S]*?<\/defs>/gi, "");
  const tags = body.match(/<g\b[^>]*>|<\/g>|<path\b[^>]*>/gi) ?? [];
  const stack: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const paths: LogoPath[] = [];
  for (const tag of tags) {
    if (/^<\/g/i.test(tag)) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (/^<g\b/i.test(tag)) {
      const parent = stack[stack.length - 1];
      const [tx, ty] = translateOf(tag);
      stack.push({ x: parent.x + tx, y: parent.y + ty });
      continue;
    }
    const d = attribute(tag, "d");
    if (!d) continue;
    const parent = stack[stack.length - 1];
    const [tx, ty] = translateOf(tag);
    paths.push({ d, x: parent.x + tx, y: parent.y + ty });
  }
  return paths;
}

export async function buildWorkOrderPdf(input: WorkOrderPdfInput): Promise<Uint8Array> {
  const logoSvg = input.logoSvg ?? (await readFile(logoFilePath(), "utf8"));
  const doc = await PDFDocument.create();
  doc.setTitle(`Work order ${input.number}`);
  doc.setAuthor("TNK Property Services");
  doc.setSubject(pdfSafe(input.caseSubject).slice(0, 200));
  doc.setCreator("TNK Property Services");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sheet = new Sheet(doc, font, bold, input.number);
  sheet.drawHeader(logoSvg, input);
  sheet.section("Building", `${input.buildingName}\n${input.buildingAddress}`);
  sheet.section("Contractor", input.companyName);
  sheet.section("Contact", `${input.contactName}\n${input.contactEmail}`);
  sheet.section("Case", `#${input.caseNumber}\n${input.caseType}\n${input.caseSubject}`);
  sheet.section("Job area", input.jobArea);
  sheet.section("Instructions", input.instructions.trim() || "No instructions were added.");
  sheet.section("Purchase order", input.purchaseOrderNumber?.trim() || "Not set");
  sheet.section("Attending", input.attendingAt ? formatDateTime(input.attendingAt) : "Not set");
  sheet.section("Access notes", input.accessNotes?.trim() || "None");
  sheet.section("Attachments", input.attachmentNames.length ? input.attachmentNames.join("\n") : "None");
  return doc.save();
}

class Sheet {
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN;

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private number: string,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  drawHeader(logoSvg: string, input: WorkOrderPdfInput) {
    const top = this.y;
    drawLogo(this.page, logoSvg, MARGIN, top, LOGO_WIDTH);
    this.page.drawText("Work order", {
      x: MARGIN + LOGO_WIDTH + 16,
      y: top - 22,
      size: 18,
      font: this.bold,
      color: NAVY,
    });
    this.page.drawText(pdfSafe(input.number), {
      x: MARGIN + LOGO_WIDTH + 16,
      y: top - 42,
      size: 14,
      font: this.bold,
      color: INK,
    });
    this.page.drawText(pdfSafe(formatDateTime(input.sentAt)), {
      x: MARGIN + LOGO_WIDTH + 16,
      y: top - 58,
      size: 10,
      font: this.font,
      color: MUTED,
    });
    this.y = top - 70;
    this.rule();
  }

  section(label: string, value: string) {
    this.paragraph(label, 9, true, MUTED);
    this.paragraph(value, 11, false, INK);
    this.y -= 8;
  }

  private paragraph(text: string, size: number, strong: boolean, color: ReturnType<typeof rgb>) {
    const font = strong ? this.bold : this.font;
    const lines = wrap(pdfSafe(text), font, size, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      this.ensure(size + 4);
      this.page.drawText(line.length ? line : " ", {
        x: MARGIN,
        y: this.y - size,
        size,
        font,
        color,
      });
      this.y -= size + 4;
    }
  }

  private rule() {
    this.ensure(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: NAVY,
    });
    this.y -= 14;
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN) return;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
    this.page.drawText(pdfSafe(`Work order ${this.number}`), {
      x: MARGIN,
      y: this.y - 12,
      size: 11,
      font: this.bold,
      color: NAVY,
    });
    this.y -= 24;
  }
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
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
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

function pdfSafe(value: string): string {
  return value.replace(/[^\n\r\t\x20-\x7E]/g, "?");
}

function translateOf(tag: string): [number, number] {
  const match = /translate\(\s*(-?\d*\.?\d+)(?:[\s,]+(-?\d*\.?\d+))?\s*\)/.exec(tag);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2] ?? 0)];
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}
