import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

const BLACK = rgb(0, 0, 0);
const INK = rgb(0.12, 0.12, 0.12);
const GREY = rgb(0.35, 0.35, 0.35);
const LINE = rgb(0.75, 0.75, 0.75);
const BAR = rgb(0.9, 0.9, 0.9);
const BLUE = rgb(0.1, 0.33, 0.75);
const WHITE = rgb(1, 1, 1);
const NAVY = rgb(0, 0, 128 / 255);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_WIDTH = 156;

export type WorkOrderPdfPhoto = {
  name: string;
  bytes: Uint8Array;
};

export type WorkOrderPdfInput = {
  number: string;
  companyName: string;
  buildingLine: string;
  buildingAddress: string;
  siteContactName: string;
  siteContactMobile: string;
  siteContactEmail: string;
  viewUrl: string;
  checkInUrl: string;
  dateRequested: string;
  dueBy: string;
  priority: string;
  assignedContractor: string;
  subject: string;
  description: string;
  jobArea: string;
  assets: string;
  photos: WorkOrderPdfPhoto[];
  terms: string;
  logoSvg?: string;
};

type LogoPath = { d: string; x: number; y: number };
type Color = ReturnType<typeof rgb>;

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
  doc.setAuthor(pdfSafe(input.companyName).slice(0, 200) || "TNK Property Services");
  doc.setSubject(pdfSafe(input.subject).slice(0, 200));
  doc.setCreator("TNK Property Services");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const photos: PDFImage[] = [];
  for (const photo of input.photos) {
    const image = await embedPhoto(doc, photo);
    if (image) photos.push(image);
  }
  const sheet = new Sheet(doc, font, bold, input.number);
  sheet.drawHeader(logoSvg, input);
  sheet.detailTable([
    { label: "Date Requested", value: input.dateRequested },
    { label: "Due By", value: input.dueBy },
    { label: "Priority", value: input.priority },
    { label: "Assigned Contractor", value: input.assignedContractor },
  ]);
  sheet.sectionBar("Job Information");
  sheet.stacked("Subject", input.subject);
  sheet.stacked("Job Description", input.description);
  sheet.labelRow("Job Area", input.jobArea);
  sheet.labelRow("Assets", input.assets);
  sheet.photos(photos);
  if (input.terms.trim()) {
    sheet.sectionBar("Terms & Conditions");
    sheet.body(input.terms);
  }
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
    const top = PAGE_HEIGHT - 36;
    drawLogo(this.page, logoSvg, MARGIN, top, LOGO_WIDTH);
    const logoHeight = 126 * (LOGO_WIDTH / 407);
    let y = top - logoHeight - 18;
    this.page.drawText(pdfSafe(`WORK ORDER #${input.number}`), {
      x: MARGIN,
      y: y - 22,
      size: 22,
      font: this.bold,
      color: BLACK,
    });
    y -= 40;

    const buttonWidth = 158;
    const buttonHeight = 30;
    const buttonX = PAGE_WIDTH - MARGIN - buttonWidth;
    const leftWidth = buttonX - MARGIN - 18;
    const columnTop = y;

    y = this.block(input.companyName, MARGIN, y, leftWidth, 12, true, BLACK);
    y -= 2;
    y = this.block(input.buildingLine, MARGIN, y, leftWidth, 11, true, BLACK);
    y -= 2;
    y = this.block(input.buildingAddress, MARGIN, y, leftWidth, 10, false, INK);
    y -= 8;
    y = this.labeled(y, leftWidth, "Site Contact", input.siteContactName);
    y = this.labeled(y, leftWidth, "Mobile", input.siteContactMobile);
    const email = input.siteContactEmail.trim();
    y = this.labeled(y, leftWidth, "Email", email, email ? `mailto:${email}` : undefined);

    this.button(buttonX, columnTop - buttonHeight, buttonWidth, buttonHeight, "View Work Order", true, input.viewUrl);
    this.button(
      buttonX,
      columnTop - buttonHeight * 2 - 8,
      buttonWidth,
      buttonHeight,
      "On-Site Check In",
      false,
      input.checkInUrl,
    );

    const buttonsBottom = columnTop - buttonHeight * 2 - 8;
    this.y = Math.min(y, buttonsBottom) - 12;
    this.rule();
  }

  detailTable(cells: { label: string; value: string }[]) {
    const padX = 8;
    const padY = 7;
    const labelSize = 8;
    const valueSize = 10;
    const columnWidths = [210, CONTENT_WIDTH - 210];
    const pairs: { label: string; lines: string[] }[][] = [];
    for (let index = 0; index < cells.length; index += 2) {
      pairs.push(
        cells.slice(index, index + 2).map((cell, column) => ({
          label: cell.label,
          lines: wrap(pdfSafe(cell.value), this.font, valueSize, columnWidths[column] - padX * 2),
        })),
      );
    }
    const rowHeights = pairs.map((row) => {
      const lines = Math.max(...row.map((cell) => Math.max(cell.lines.length, 1)));
      return padY + labelSize + 4 + lines * (valueSize + 3) + padY;
    });
    const total = rowHeights.reduce((sum, height) => sum + height, 0);
    this.ensure(total);
    const bottom = this.y - total;
    this.page.drawRectangle({
      x: MARGIN,
      y: bottom,
      width: CONTENT_WIDTH,
      height: total,
      borderColor: LINE,
      borderWidth: 0.8,
      color: WHITE,
    });
    this.page.drawLine({
      start: { x: MARGIN + columnWidths[0], y: bottom },
      end: { x: MARGIN + columnWidths[0], y: this.y },
      thickness: 0.6,
      color: LINE,
    });
    let rowTop = this.y;
    pairs.forEach((row, index) => {
      if (index > 0) {
        this.page.drawLine({
          start: { x: MARGIN, y: rowTop },
          end: { x: MARGIN + CONTENT_WIDTH, y: rowTop },
          thickness: 0.6,
          color: LINE,
        });
      }
      row.forEach((cell, column) => {
        const x = MARGIN + (column === 0 ? 0 : columnWidths[0]) + padX;
        this.page.drawText(pdfSafe(cell.label), {
          x,
          y: rowTop - padY - labelSize,
          size: labelSize,
          font: this.bold,
          color: GREY,
        });
        let lineY = rowTop - padY - labelSize - 4 - valueSize;
        for (const line of cell.lines) {
          this.page.drawText(line.length ? line : " ", {
            x,
            y: lineY,
            size: valueSize,
            font: this.font,
            color: INK,
          });
          lineY -= valueSize + 3;
        }
      });
      rowTop -= rowHeights[index];
    });
    this.y = bottom - 16;
  }

  // Reserve the bar plus the following line so a heading is not left alone at the bottom.
  sectionBar(title: string) {
    const bar = 22;
    const gapBefore = 4;
    const gapAfter = 10;
    const keep = 32;
    this.ensure(gapBefore + bar + gapAfter + keep);
    this.y -= gapBefore;
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - bar,
      width: CONTENT_WIDTH,
      height: bar,
      color: BAR,
    });
    this.page.drawText(pdfSafe(title), {
      x: MARGIN + 8,
      y: this.y - 15,
      size: 11,
      font: this.bold,
      color: BLACK,
    });
    this.y -= bar + gapAfter;
  }

  stacked(label: string, value: string) {
    this.ensure(30);
    this.page.drawText(pdfSafe(label), {
      x: MARGIN,
      y: this.y - 11,
      size: 10,
      font: this.bold,
      color: GREY,
    });
    this.y -= 16;
    const lines = wrap(pdfSafe(value), this.font, 11, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensure(15);
      this.page.drawText(line.length ? line : " ", {
        x: MARGIN,
        y: this.y - 11,
        size: 11,
        font: this.font,
        color: INK,
      });
      this.y -= 15;
    }
    this.y -= 6;
  }

  labelRow(label: string, value: string) {
    const labelWidth = 108;
    const size = 10;
    const lines = wrap(pdfSafe(value), this.font, size, CONTENT_WIDTH - labelWidth);
    const height = Math.max(lines.length, 1) * 14 + 4;
    this.ensure(height);
    this.page.drawText(pdfSafe(label), {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.bold,
      color: GREY,
    });
    let cursor = this.y;
    for (const line of lines) {
      this.page.drawText(line.length ? line : " ", {
        x: MARGIN + labelWidth,
        y: cursor - size,
        size,
        font: this.font,
        color: INK,
      });
      cursor -= 14;
    }
    this.y -= height;
  }

  photos(images: PDFImage[]) {
    if (images.length === 0) {
      this.labelRow("Photos", "");
      return;
    }
    const size = 72;
    const gap = 8;
    this.ensure(16 + size);
    this.page.drawText("Photos", {
      x: MARGIN,
      y: this.y - 11,
      size: 10,
      font: this.bold,
      color: GREY,
    });
    this.y -= 16;
    let x = MARGIN;
    for (const image of images) {
      if (x > MARGIN && x + size > MARGIN + CONTENT_WIDTH) {
        x = MARGIN;
        this.y -= size + gap;
      }
      if (this.y - size < MARGIN) {
        this.newPage();
        x = MARGIN;
      }
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      this.page.drawImage(image, {
        x: x + (size - width) / 2,
        y: this.y - size + (size - height) / 2,
        width,
        height,
      });
      x += size + gap;
    }
    this.y -= size + 12;
  }

  body(value: string) {
    const lines = wrap(pdfSafe(value), this.font, 10, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensure(14);
      this.page.drawText(line.length ? line : " ", {
        x: MARGIN,
        y: this.y - 10,
        size: 10,
        font: this.font,
        color: INK,
      });
      this.y -= 14;
    }
  }

  private block(text: string, x: number, y: number, width: number, size: number, strong: boolean, color: Color): number {
    const font = strong ? this.bold : this.font;
    const lines = wrap(pdfSafe(text), font, size, width);
    let cursor = y;
    for (const line of lines) {
      this.page.drawText(line.length ? line : " ", { x, y: cursor - size, size, font, color });
      cursor -= size + 3;
    }
    return cursor;
  }

  private labeled(y: number, width: number, label: string, value: string, link?: string): number {
    const size = 10;
    const labelText = `${label}:`;
    const labelWidth = this.bold.widthOfTextAtSize(labelText, size);
    const gap = 6;
    const lines = wrap(pdfSafe(value), this.font, size, Math.max(40, width - labelWidth - gap));
    let cursor = y;
    lines.forEach((line, index) => {
      const baseline = cursor - size;
      if (index === 0) {
        this.page.drawText(labelText, { x: MARGIN, y: baseline, size, font: this.bold, color: GREY });
      }
      const textX = MARGIN + labelWidth + gap;
      const text = line.length ? line : " ";
      this.page.drawText(text, {
        x: textX,
        y: baseline,
        size,
        font: this.font,
        color: link ? BLUE : INK,
      });
      if (link && line.length) {
        const textWidth = this.font.widthOfTextAtSize(text, size);
        this.page.drawLine({
          start: { x: textX, y: baseline - 1.5 },
          end: { x: textX + textWidth, y: baseline - 1.5 },
          thickness: 0.6,
          color: BLUE,
        });
        addUriLink(this.page, link, textX, baseline - 2, textX + textWidth, baseline + size);
      }
      cursor -= size + 4;
    });
    return cursor;
  }

  private button(x: number, bottom: number, width: number, height: number, label: string, filled: boolean, url: string) {
    this.page.drawRectangle({
      x,
      y: bottom,
      width,
      height,
      color: filled ? BLACK : WHITE,
      borderColor: BLACK,
      borderWidth: filled ? 0 : 1.25,
    });
    const size = 10;
    const textWidth = this.bold.widthOfTextAtSize(label, size);
    this.page.drawText(label, {
      x: x + (width - textWidth) / 2,
      y: bottom + (height - size) / 2 + 1,
      size,
      font: this.bold,
      color: filled ? WHITE : BLACK,
    });
    addUriLink(this.page, url, x, bottom, x + width, bottom + height);
  }

  private rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.7,
      color: LINE,
    });
    this.y -= 14;
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN) return;
    this.newPage();
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - 36;
    this.page.drawText(pdfSafe(`WORK ORDER #${this.number}`), {
      x: MARGIN,
      y: this.y - 11,
      size: 10,
      font: this.bold,
      color: GREY,
    });
    this.y -= 18;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.6,
      color: LINE,
    });
    this.y -= 16;
  }
}

async function embedPhoto(doc: PDFDocument, photo: WorkOrderPdfPhoto): Promise<PDFImage | null> {
  const stored = photo.name.toLowerCase();
  try {
    if (stored.endsWith(".png")) return await doc.embedPng(photo.bytes);
    if (stored.endsWith(".jpg") || stored.endsWith(".jpeg")) return await doc.embedJpg(photo.bytes);
  } catch {
    return null;
  }
  return null;
}

function addUriLink(page: PDFPage, url: string, x1: number, y1: number, x2: number, y2: number) {
  const doc = page.doc;
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x1, y1, x2, y2],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(url),
    },
  });
  const existing = page.node.Annots();
  if (existing) existing.push(annot);
  else page.node.set(PDFName.of("Annots"), doc.context.obj([annot]));
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
      current = appendWord(lines, current, word, font, size, width);
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function appendWord(lines: string[], current: string, word: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(word, size) > width) {
    if (current) lines.push(current);
    let chunk = "";
    for (const char of word) {
      const next = chunk + char;
      if (font.widthOfTextAtSize(next, size) <= width) chunk = next;
      else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    return chunk;
  }
  const next = current ? `${current} ${word}` : word;
  if (font.widthOfTextAtSize(next, size) <= width) return next;
  if (current) lines.push(current);
  return word;
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
