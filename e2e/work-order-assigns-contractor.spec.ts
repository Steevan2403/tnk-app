import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";
const company = "Sample Plumbing Co";
const contact = "Casey Placeholder · casey.placeholder@example.com";
const period = "11 Nov 2026 to 11 Nov 2026";

test("sending a work order assigns the contractor once, on the case and in the report", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);

  await page.goto("/cases/312");
  await expect(page.getByRole("heading", { level: 1, name: "Example rooftop filter service" })).toBeVisible();
  const assigned = page.getByRole("heading", { name: "Assigned contractors" }).locator("xpath=ancestor::section[1]");
  await expect(assigned.getByText("No contractor assigned.")).toBeVisible();

  await send(page, "312-A");
  await expect(assigned.getByRole("link", { name: company, exact: true })).toHaveCount(1);
  await expect(assigned.getByText("No contractor assigned.")).toHaveCount(0);

  await send(page, "312-B");
  await expect(assigned.getByRole("link", { name: company, exact: true })).toHaveCount(1);
  await expect(page.getByText("Sent work order 312-A to Sample Plumbing Co (Casey Placeholder).")).toBeVisible();
  await expect(page.getByText("Sent work order 312-B to Sample Plumbing Co (Casey Placeholder).")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 1000 });
  await assigned.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, "case-panel-assigned-contractor.png"), fullPage: true });

  await page.goto("/building/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "From", exact: true }).fill("2026-11-11");
  await page.getByRole("textbox", { name: "To", exact: true }).fill("2026-11-11");
  await expect(page.getByRole("checkbox", { name: "Include case 312", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Include case 307", exact: true })).toHaveCount(0);

  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "312", exact: true }) });
  await expect(row.getByRole("cell", { name: company, exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "None", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Generate PDF" }).click();
  await expect(page.getByText("The report is ready.")).toBeVisible();
  const pdfLink = page.getByRole("link", { name: `Download PDF for ${period}` });
  await expect(pdfLink).toBeVisible();
  const pdfResponse = await page.request.get((await pdfLink.getAttribute("href"))!);
  expect(pdfResponse.ok()).toBeTruthy();
  const pdf = await pdfResponse.body();
  const pdfPath = path.join(artifacts, "case-312-management-report.pdf");
  writeFileSync(pdfPath, pdf);

  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  const detail = text.slice(text.indexOf("Example rooftop filter service"));
  expect(detail.length).toBeGreaterThan(0);
  expect(detail).toContain(company);
  expect(detail).not.toMatch(/Contractor\s*\n\s*None\b/);
});

async function send(page: Page, number: string) {
  await page.goto("/cases/312/work-order");
  await expect(page.getByRole("heading", { name: "Send work order" })).toBeVisible();
  await page.getByLabel("Contractor").selectOption({ label: company });
  await page.getByLabel("Contact").selectOption({ label: contact });
  await page.getByRole("button", { name: "Email work order to contractor" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example rooftop filter service" })).toBeVisible();
  await expect(page.getByText(`Sent work order ${number} to Sample Plumbing Co (Casey Placeholder).`)).toBeVisible();
}

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
