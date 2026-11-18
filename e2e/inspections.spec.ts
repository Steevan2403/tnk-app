import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";

test("staff runs an inspection on a phone and an admin reads the report", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  const photoPath = path.join(shots, "example-crack.png");
  writeFileSync(photoPath, solidPng(80, 60, [180, 40, 40, 255]));

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);

  await page.goto("/building/inspections/templates/new");
  await expect(page.getByRole("heading", { name: "New template" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Example plant room inspection");
  await page.getByLabel("Description").fill("Example monthly look at the plant room.");
  await page.getByLabel("Area name").first().fill("Plant room");
  await page.getByLabel("Item", { exact: true }).first().fill("Pump seals");
  await page.getByLabel("Guidance note").first().fill("Example: look for drips.");
  await page.getByRole("button", { name: "Add area" }).click();
  await page.getByLabel("Area name").nth(1).fill("Switch room");
  await page.getByLabel("Item", { exact: true }).nth(1).fill("Distribution board");
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "inspections-template-builder.png");
  await page.getByRole("button", { name: "Save template" }).click();

  await expect(page.getByRole("heading", { name: "Inspections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example plant room inspection", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Monthly common area inspection", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lot exit inspection", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, "inspections-templates.png");

  await signOut(page);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await selectExampleTower(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/building/inspections");
  await page.getByRole("link", { name: "Start inspection Monthly common area inspection" }).click();
  await expect(page.getByRole("heading", { name: "Start inspection" })).toBeVisible();
  await page.getByRole("button", { name: "Start inspection" }).click();

  await expect(page.getByRole("heading", { name: "Monthly common area inspection" })).toBeVisible();
  const runUrl = page.url();
  await page.getByRole("button", { name: "Pass Entrance doors" }).click();
  await expect(page.getByRole("button", { name: "Pass Entrance doors" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Comment for Lobby floor").fill("Example crack near the mailboxes.");
  await page.getByRole("button", { name: "Fail Lobby floor" }).click();
  await expect(page.getByRole("button", { name: "Fail Lobby floor" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Comment for Lobby floor")).toHaveValue("Example crack near the mailboxes.");
  await page.getByRole("button", { name: "Not applicable Lobby lighting" }).click();
  await expect(page.getByRole("button", { name: "Not applicable Lobby lighting" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Photo for Lobby floor").setInputFiles(photoPath);
  await expect(page.getByRole("img", { name: "example-crack.png" })).toBeVisible();
  await expect(page.getByText("3 of 10 items answered")).toBeVisible();
  await shot(page, "inspections-run-mobile.png");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Complete inspection" }).click();
  await expect(page.getByText("7 unanswered")).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete inspection" })).toHaveCount(0);
  await page.getByRole("article", { name: "Lobby floor" }).getByRole("button", { name: "Create case for Lobby floor" }).click();
  const caseLink = page.getByRole("article", { name: "Lobby floor" }).getByRole("link", { name: /^Case #\d+$/ });
  await expect(caseLink).toBeVisible();
  const caseHref = await caseLink.getAttribute("href");
  expect(caseHref).toMatch(/^\/cases\/\d+$/);

  await signOut(page);
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(runUrl);
  await expect(page.getByRole("heading", { name: "Monthly common area inspection" })).toBeVisible();
  await expect(page.getByText("Example crack near the mailboxes.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Case #\d+$/ })).toBeVisible();
  await shot(page, "inspections-report-desktop.png");

  const pdfHref = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  expect(pdfHref).toBeTruthy();
  const pdfResponse = await page.request.get(pdfHref!);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  const pdf = await pdfResponse.body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const loaded = await PDFDocument.load(pdf);
  expect(loaded.getTitle()).toContain("Monthly common area inspection");
  const pdfPath = path.join(artifacts, "inspection-report.pdf");
  writeFileSync(pdfPath, pdf);
  execFileSync("pdftoppm", ["-png", "-r", "140", "-f", "1", "-l", "1", "-singlefile", pdfPath, path.join(artifacts, "inspections-report-pdf")]);

  await page.goto(caseHref!);
  await expect(page.getByRole("heading", { level: 1, name: "Lobby floor (Lobby)" })).toBeVisible();
  await expect(page.getByText("Example crack near the mailboxes.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Monthly common area inspection" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "inspections-case.png");
});

async function selectExampleTower(page: Page) {
  const switcher = page.getByRole("button", { name: /Switch building/ });
  if (!(await switcher.innerText()).includes("Example Tower")) {
    await switcher.click();
    await page
      .locator("aside")
      .getByRole("button", { name: "Example Tower 100 Example Street, Sydney NSW 2000", exact: true })
      .click();
    await expect(switcher).toContainText("Example Tower");
  }
}

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

async function signOut(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
  await page.screenshot({ path: path.join(artifacts, name), fullPage: true });
}

function solidPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 4] = rgba[0];
    row[2 + x * 4] = rgba[1];
    row[3 + x * 4] = rgba[2];
    row[4 + x * 4] = rgba[3];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => Buffer.from(row)));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header(width, height)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function header(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  return buffer;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
