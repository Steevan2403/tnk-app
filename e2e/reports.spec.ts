import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const shots = path.join("test-results", "screenshots");
const period = "1 Nov 2026 to 30 Nov 2026";

test("admin builds a filtered report, and staff cannot generate one", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await useExampleTower(page);
  await page.goto("/building/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "This month", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "From", exact: true })).toHaveValue("2026-11-01");
  await expect(page.getByRole("textbox", { name: "To", exact: true })).toHaveValue("2026-11-30");
  await page.getByLabel("Case type", { exact: true }).selectOption({ label: "Repair & maintenance" });

  await expect(page.getByRole("checkbox", { name: "Include case 307", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Include case 311", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Include case 314", exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Include case 300", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Include case 311", exact: true }).uncheck();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("region", { name: "Report builder" }).screenshot({
    path: path.join(shots, "reports-builder.png"),
  });

  await page.getByRole("button", { name: "Generate PDF" }).click();
  await expect(page.getByText("The report is ready.")).toBeVisible();

  await page.getByRole("button", { name: "This month", exact: true }).click();
  await page.getByLabel("Case type", { exact: true }).selectOption({ label: "Repair & maintenance" });
  await page.getByRole("checkbox", { name: "Include case 311", exact: true }).uncheck();
  await page.getByRole("button", { name: "Generate Excel" }).click();
  await expect(page.getByText("The report is ready.")).toBeVisible();

  const list = page.getByRole("region", { name: "Generated reports" });
  const pdfLink = list.getByRole("link", { name: `Download PDF for ${period}` });
  const excelLink = list.getByRole("link", { name: `Download Excel for ${period}` });
  await expect(pdfLink).toBeVisible();
  await expect(excelLink).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await list.screenshot({ path: path.join(shots, "reports-list.png") });

  const pdfHref = await pdfLink.getAttribute("href");
  const excelHref = await excelLink.getAttribute("href");
  expect(pdfHref).toBeTruthy();
  expect(excelHref).toBeTruthy();

  const pdfResponse = await page.request.get(pdfHref!);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  const pdf = await pdfResponse.body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfHas(pdf, "Case #307")).toBe(true);
  expect(pdfHas(pdf, "Case #310")).toBe(true);
  expect(pdfHas(pdf, "Case #311")).toBe(false);
  expect(pdfHas(pdf, "Case #314")).toBe(false);
  const pdfPath = path.join(shots, "management-report.pdf");
  writeFileSync(pdfPath, pdf);
  const pdfDownload = page.waitForEvent("download");
  await pdfLink.click();
  expect((await pdfDownload).suggestedFilename()).toContain(".pdf");

  const excelResponse = await page.request.get(excelHref!);
  expect(excelResponse.ok()).toBeTruthy();
  expect(excelResponse.headers()["content-type"]).toContain("spreadsheetml.sheet");
  const excel = await excelResponse.body();
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(excel as unknown as Parameters<typeof book.xlsx.load>[0]);
  const numbers = book.getWorksheet("Cases")!.getColumn(1).values.slice(1).map((value) => String(value ?? ""));
  expect(numbers).toContain("307");
  expect(numbers).toContain("310");
  expect(numbers).not.toContain("311");
  expect(book.getWorksheet("Maintenance")).toBeTruthy();
  const excelDownload = page.waitForEvent("download");
  await excelLink.click();
  expect((await excelDownload).suggestedFilename()).toContain(".xlsx");

  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "Management reports" });
  await expect(card.getByRole("link", { name: `View PDF for ${period}` })).toBeVisible();
  await expect(card.getByRole("link", { name: `View Excel for ${period}` })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await card.screenshot({ path: path.join(shots, "reports-dashboard-card.png") });

  renderPdfPages(pdfPath, shots);

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.goto("/building/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate PDF" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate Excel" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Email report" })).toHaveCount(0);
  await expect(list.getByRole("link", { name: `Download PDF for ${period}` })).toBeVisible();
  const staffPdf = await page.request.get(pdfHref!);
  expect(staffPdf.ok()).toBeTruthy();
  expect((await staffPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

function renderPdfPages(pdfPath: string, directory: string) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  let cover = 0;
  let summary = 0;
  let casePage = 0;
  for (let page = 1; page <= pages; page += 1) {
    const text = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdfPath, "-"], { encoding: "utf8" });
    if (!cover && text.includes("Prepared by")) cover = page;
    if (!summary && text.includes("Cases opened")) summary = page;
    if (!casePage && text.includes("Description") && /Case #\d+/.test(text)) casePage = page;
  }
  if (!cover || !summary || !casePage) throw new Error(`Could not find cover, summary, and case pages in ${pages} pages.`);
  renderPage(pdfPath, directory, cover, "reports-pdf-cover");
  renderPage(pdfPath, directory, summary, "reports-pdf-summary");
  renderPage(pdfPath, directory, casePage, "reports-pdf-case");
}

function renderPage(pdfPath: string, directory: string, page: number, name: string) {
  execFileSync("pdftoppm", ["-png", "-r", "120", "-f", String(page), "-l", String(page), pdfPath, path.join(directory, name)]);
}

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

async function useExampleTower(page: Page) {
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
