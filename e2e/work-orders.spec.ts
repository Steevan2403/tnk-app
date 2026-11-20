import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAK0lEQVR4nO3OoQEAAAwCIE/f5/MMC4FOkvstAQEBAQEBAQEBAQEBAQGBcaCplfxMSDnSHwAAAABJRU5ErkJggg==",
  "base64",
);

test("admin sends a work order from a case and it shows on the list, PDF, outbox, and activity", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  const switcher = page.getByRole("button", { name: /Switch building/ });
  if (!(await switcher.innerText()).includes("Example Tower")) {
    await switcher.click();
    await page
      .locator("aside")
      .getByRole("button", { name: "Example Tower 100 Example Street, Sydney NSW 2000", exact: true })
      .click();
    await expect(switcher).toContainText("Example Tower");
  }
  await page.goto("/cases/305");
  await expect(page.getByRole("heading", { level: 1, name: "Example noise complaint for apartment 104" })).toBeVisible();
  await uploadCaseFile(page, "Photos", { name: "pump.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Added photo pump.png.")).toBeVisible();
  await uploadCaseFile(page, "Documents", {
    name: "example-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Example note for the contractor.\n"),
  });
  await expect(page.getByText("Added document example-note.txt.")).toBeVisible();
  await page.getByRole("link", { name: "Send work order" }).first().click();

  await expect(page.getByRole("heading", { name: "Send work order" })).toBeVisible();
  await expect(page.getByLabel("Subject")).toHaveValue(/Work order 305-A:/);
  await page.getByLabel("Contractor").selectOption({ label: "Fictional Fire Services" });
  await page.getByLabel("Contact").selectOption({ label: "Avery Sample · avery.sample@example.com" });
  await expect(page.getByLabel("Message")).toHaveValue(/evening noise/);
  await page.getByLabel("Access notes").fill("Example: use the lobby intercom.");
  await page.getByRole("checkbox", { name: /pump\.png/ }).check();
  await page.getByRole("checkbox", { name: /example-note\.txt/ }).check();
  await expect(page.getByText(/\(photo, \d+ B\)/)).toBeVisible();
  await expect(page.getByText(/\(document, \d+ B\)/)).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "work-order-send-desktop.png");
  mkdirSync(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, "work-order-send-attachments.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "work-order-send-mobile.png");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Email work order to contractor" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Example noise complaint for apartment 104" })).toBeVisible();
  await expect(page.getByText("Sent work order 305-A to Fictional Fire Services (Avery Sample).")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work orders" }).locator("..").getByText("305-A")).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("new");

  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "case-work-orders-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "case-work-orders-mobile.png");

  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Work Orders" }).click();
  await expect(page.getByRole("heading", { name: "Work Orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: "305-A", exact: true })).toBeVisible();
  await shot(page, "work-orders-list-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "work-orders-list-mobile.png");

  await page.setViewportSize({ width: 1280, height: 900 });
  const pdfHref = await page.getByRole("link", { name: "View PDF for 305-A" }).getAttribute("href");
  expect(pdfHref).toBeTruthy();
  const pdfResponse = await page.request.get(pdfHref!);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  const pdf = await pdfResponse.body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect((await PDFDocument.load(pdf)).getTitle()).toContain("305-A");
  expect(pdfDraws(pdf, "305-A")).toBe(true);
  const pdfText = `${pdf.toString("latin1")}\n${inflatePdf(pdf)}`;
  expect(pdfText).toContain("/check-in/");
  expect(pdfText.includes("checkin=1")).toBe(false);
  expect(pdfText).toContain("/Subtype /Image");
  mkdirSync("test-results", { recursive: true });
  writeFileSync(path.join("test-results", "work-order-305-A.pdf"), pdf);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "View PDF for 305-A" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("305-A");

  await page.goto("/settings/outbox");
  const message = page.getByRole("article", { name: /Work order 305-A/ });
  await expect(message.getByText("avery.sample@example.com")).toBeVisible();
  const attachment = message.getByRole("link", { name: "work-order-305-A.pdf" });
  await expect(attachment).toBeVisible();
  const attachmentHref = await attachment.getAttribute("href");
  const attachmentResponse = await page.request.get(attachmentHref!);
  expect(attachmentResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await attachmentResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const photo = message.getByRole("link", { name: "pump.png" });
  await expect(photo).toBeVisible();
  await expect(photo.locator("xpath=..")).toContainText(/\d+ B/);
  const photoResponse = await page.request.get((await photo.getAttribute("href"))!);
  expect(photoResponse.headers()["content-type"]).toContain("image/png");
  expect((await photoResponse.body()).equals(png)).toBe(true);

  const note = message.getByRole("link", { name: "example-note.txt" });
  await expect(note).toBeVisible();
  await expect(note.locator("xpath=..")).toContainText(/\d+ B/);
  const noteResponse = await page.request.get((await note.getAttribute("href"))!);
  expect(noteResponse.headers()["content-type"]).toContain("text/plain");
  expect((await noteResponse.body()).toString()).toBe("Example note for the contractor.\n");

  await message.screenshot({ path: path.join(artifacts, "outbox-message-attachments.png") });
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "outbox-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "outbox-mobile.png");
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

test("a file that does not fit is linked, and smaller files are still attached", async ({ page, request }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  const switcher = page.getByRole("button", { name: /Switch building/ });
  if (!(await switcher.innerText()).includes("Example Tower")) {
    await switcher.click();
    await page
      .locator("aside")
      .getByRole("button", { name: "Example Tower 100 Example Street, Sydney NSW 2000", exact: true })
      .click();
    await expect(switcher).toContainText("Example Tower");
  }

  await page.goto("/cases/306");
  await expect(page.getByRole("heading", { level: 1, name: "Example fire panel service" })).toBeVisible();
  const large = Buffer.alloc(10 * 1024 * 1024, 0x61);
  await uploadCaseFile(page, "Documents", { name: "example-large.txt", mimeType: "text/plain", buffer: large });
  await expect(page.getByText("Added document example-large.txt.")).toBeVisible();
  await uploadCaseFile(page, "Photos", { name: "panel.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Added photo panel.png.")).toBeVisible();

  await page.getByRole("link", { name: "Send work order" }).first().click();
  await page.getByLabel("Contractor").selectOption({ label: "Fictional Fire Services" });
  await page.getByLabel("Contact").selectOption({ label: "Avery Sample · avery.sample@example.com" });
  await page.getByRole("checkbox", { name: /example-large\.txt/ }).check();
  await page.getByRole("checkbox", { name: /panel\.png/ }).check();
  await expect(page.getByRole("status")).toContainText("The selected files are over 10 MB");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(artifacts, "work-order-send-too-big.png"), fullPage: true });
  await page.getByRole("button", { name: "Email work order to contractor" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Example fire panel service" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Work order 306-A was sent. example-large.txt was too large to attach and is linked in the email.",
  );

  await page.goto("/settings/outbox");
  const message = page.getByRole("article", { name: /Work order 306-A/ });
  await expect(message.getByRole("link", { name: "work-order-306-A.pdf" })).toBeVisible();
  await expect(message.getByRole("link", { name: "panel.png" })).toBeVisible();
  await expect(message.getByRole("link", { name: "panel.png" }).locator("xpath=..")).toContainText(/\d+ B/);
  await expect(message.getByRole("link", { name: "example-large.txt" })).toHaveCount(0);
  await expect(message.getByText("example-large.txt (10 MB)")).toBeVisible();
  const link = (await message.innerText()).match(/https?:\/\/\S+\/api\/work-order-files\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/)?.[0];
  expect(link).toBeTruthy();
  const download = await request.get(link!);
  expect(download.ok()).toBeTruthy();
  expect(download.headers()["content-type"]).toContain("text/plain");
  expect((await download.body()).length).toBe(large.length);
  const token = link!.split("/api/work-order-files/")[1]?.split("/")[0];
  const missing = await request.get(`/api/work-order-files/${token}/not-a-case-file`);
  expect(missing.status()).toBe(404);
  const badToken = await request.get("/api/work-order-files/not-a-real-token/file");
  expect(badToken.status()).toBe(404);

  await message.screenshot({ path: path.join(artifacts, "outbox-too-big-attachments.png") });
});

async function uploadCaseFile(
  page: Page,
  heading: string,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  const section = page.getByRole("heading", { name: heading, exact: true }).locator("xpath=ancestor::section[1]");
  await section.locator('input[type="file"]').setInputFiles(file);
  await section.getByRole("button", { name: /^Upload / }).click();
}

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
}
