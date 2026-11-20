import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const terms = [
  "1. Example authorisation is required before this e2e job starts.",
  "2. Example damage must be reported before extra work.",
  "3. Example compliance and insurance stay current for the visit.",
  "4. Example invoices go to accounts@example.com with the work order number.",
].join("\n");

test("admin saves work order terms and the preview PDF includes them", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.goto("/settings/work-order-terms");
  await expect(page.getByRole("heading", { name: "Work order terms" })).toBeVisible();
  await page.getByLabel("Terms & Conditions").fill(terms);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const artifacts = "/opt/cursor/artifacts";
  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(artifacts, "work-order-terms.png"), fullPage: true });

  const response = await page.request.get("/api/settings/work-order-preview");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/pdf");
  const pdf = await response.body();
  const pdfPath = path.join(artifacts, "work-order-preview.pdf");
  writeFileSync(pdfPath, pdf);
  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  expect(text).toContain("WORK ORDER #300-A");
  expect(text).toContain("Date Requested");
  expect(text).toContain("Due By");
  expect(text).toContain("Priority");
  expect(text).toContain("Assigned Contractor");
  expect(text).toContain("Example authorisation is required before this e2e job starts.");
  expect(text).toContain("Example invoices go to accounts@example.com");
  expect(text).toContain("Terms & Conditions");
  execFileSync("pdftoppm", ["-png", "-singlefile", "-f", "1", "-l", "1", "-r", "140", pdfPath, path.join(artifacts, "work-order-page-1")]);
  copyFileSync(path.join(artifacts, "work-order-page-1.png"), path.join(artifacts, "work-order-pdf-page.png"));
});

test("blank work order terms leave the terms section off the PDF", async ({ page }) => {
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.goto("/settings/work-order-terms");
  await page.getByLabel("Terms & Conditions").fill("   ");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const response = await page.request.get("/api/settings/work-order-preview");
  expect(response.ok()).toBeTruthy();
  const pdfPath = path.join("/opt/cursor/artifacts", "work-order-preview-blank.pdf");
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  writeFileSync(pdfPath, await response.body());
  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  expect(text).toContain("WORK ORDER #300-A");
  expect(text).not.toContain("Terms & Conditions");

  await page.getByLabel("Terms & Conditions").fill(terms);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
});

test("staff cannot edit work order terms", async ({ page }) => {
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Work order terms" })).toHaveCount(0);
  await page.goto("/settings/work-order-terms");
  await expect(page.getByText("Only an admin or a manager can edit work order terms.")).toBeVisible();
  await expect(page.getByLabel("Terms & Conditions")).toHaveCount(0);
});

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
