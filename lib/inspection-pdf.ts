import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatInspectionMark, formatInspectionType, resultCounts } from "./inspections";
import { logoFilePath, logoPaths } from "./work-order-pdf";

const NAVY = rgb(0, 0, 128 / 255);
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.29, 0.34, 0.39);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LOGO_WIDTH = 150;

export type InspectionPdfPhoto = {
  name: string;
  storedName: string;
  bytes: Uint8Array;
};

export type InspectionPdfInput = {
  name: string;
  type: string;
  buildingName: string;
  buildingAddress: string;
  apartmentNumber: string | null;
  inspectorName: string;
  inspectedAtLabel: string;
  completedAtLabel: string | null;
  areas: {
    name: string;
    items: {
      name: string;
      result: string | null;
      comment: string | null;
      caseNumber: number | null;
      photos: InspectionPdfPhoto[];
    }[];
  }[];
  logoSvg?: string;
};

type DrawnPhoto = { name: string; image: PDFImage } | { name: string; image: null };

export async function buildInspectionPdf(input: InspectionPdfInput): Promise<Uint8Array> {
  const logoSvg = input.logoSvg ?? (await readFile(logoFilePath(), "utf8"));
  const doc = await PDFDocument.create();
  const title = pdfSafe(input.name).slice(0, 180);
  doc.setTitle(`Inspection report: ${title}`);
  doc.setAuthor("TNK Property Services");
  doc.setSubject(title);
  doc.setCreator("TNK Property Services");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const areas = [];
  for (const area of input.areas) {
    const items = [];
    for (const item of area.items) {
      const photos: DrawnPhoto[] = [];
      for (const photo of item.photos) {
        photos.push({ name: photo.name, image: await embedPhoto(doc, photo) });
      }
      items.push({ ...item, photos });
    }
    areas.push({ name: area.name, items });
  }

  const sheet = new Sheet(doc, font, bold, input.name);
  sheet.drawHeader(logoSvg, input);
  sheet.section("Building", `${input.buildingName}\n${input.buildingAddress}`);
  sheet.section("Type", formatInspectionType(input.type));
  if (input.type === "private_lot") sheet.section("Apartment", input.apartmentNumber ?? "Not recorded");
  sheet.section("Inspector", input.inspectorName);
  sheet.section("Inspection date", input.inspectedAtLabel);
  if (input.completedAtLabel) sheet.section("Completed", input.completedAtLabel);
  const counts = resultCounts(input.areas.flatMap((area) => area.items));
  sheet.section(
    "Summary",
    `${counts.pass} pass, ${counts.fail} fail, ${counts.na} not applicable, ${counts.unanswered} unanswered`,
  );

  for (const area of areas) {
    sheet.heading(area.name);
    for (const item of area.items) {
      const lines = [
        formatInspectionMark(item.result),
        item.comment?.trim() ? item.comment.trim() : "No comment",
        item.caseNumber ? `Case #${item.caseNumber}` : item.result === "fail" ? "No case yet" : "",
      ].filter(Boolean);
      sheet.item(item.name, lines.join("\n"));
      for (const photo of item.photos) {
        if (photo.image) sheet.image(photo.image);
        sheet.note(photo.name);
      }
    }
  }

  return doc.save();
}

async function embedPhoto(doc: PDFDocument, photo: InspectionPdfPhoto): Promise<PDFImage | null> {
  const stored = photo.storedName.toLowerCase();
  try {
    if (stored.endsWith(".png")) return await doc.embedPng(photo.bytes);
    if (stored.endsWith(".jpg") || stored.endsWith(".jpeg")) return await doc.embedJpg(photo.bytes);
  } catch {
    return null;
  }
  return null;
}

class Sheet {
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN;

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private name: string,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  drawHeader(logoSvg: string, input: InspectionPdfInput) {
    const top = this.y;
    drawLogo(this.page, logoSvg, MARGIN, top, LOGO_WIDTH);
    this.page.drawText("Inspection report", {
      x: MARGIN + LOGO_WIDTH + 16,
      y: top - 22,
      size: 18,
      font: this.bold,
      color: NAVY,
    });
    this.page.drawText(pdfSafe(input.name).slice(0, 42), {
      x: MARGIN + LOGO_WIDTH + 16,
      y: top - 42,
      size: 12,
      font: this.bold,
      color: INK,
    });
    this.page.drawText(pdfSafe(input.inspectedAtLabel), {
      x: MARGIN + LOGO_WIDTH + 16,
      y: top - 58,
      size: 10,
      font: this.font,
      color: MUTED,
    });
    this.y = top - 78;
    this.rule();
  }

  heading(value: string) {
    this.y -= 4;
    this.paragraph(value, 13, true, NAVY);
    this.y -= 2;
  }

  section(label: string, value: string) {
    this.paragraph(label, 9, true, MUTED);
    this.paragraph(value, 11, false, INK);
    this.y -= 6;
  }

  item(label: string, value: string) {
    this.paragraph(label, 11, true, INK);
    this.paragraph(value, 10, false, INK);
    this.y -= 4;
  }

  note(value: string) {
    this.paragraph(value, 9, false, MUTED);
  }

  image(image: PDFImage) {
    const maxWidth = 180;
    const maxHeight = 120;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensure(height + 8);
    this.page.drawImage(image, { x: MARGIN, y: this.y - height, width, height });
    this.y -= height + 4;
  }

  private paragraph(text: string, size: number, strong: boolean, color: ReturnType<typeof rgb>) {
    const font = strong ? this.bold : this.font;
    const lines = wrap(pdfSafe(text), font, size, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      this.ensure(size + 4);
      this.page.drawText(line.length ? line : " ", { x: MARGIN, y: this.y - size, size, font, color });
      this.y -= size + 3;
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
    this.page.drawText(pdfSafe(`Inspection report: ${this.name}`).slice(0, 80), {
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
