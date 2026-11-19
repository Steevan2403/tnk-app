import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("new case keeps typed values when the due date is before the start date", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/cases/new");
  await expect(page.getByRole("heading", { name: "New case" })).toBeVisible();

  const caseType = page.getByLabel("Case type");
  await caseType.selectOption({ label: "Repair & maintenance" });
  const typeValue = await caseType.inputValue();
  await page.getByLabel("Start date").fill("2026-11-18");
  await page.getByLabel("Due date").fill("2026-11-01");
  await page.getByLabel("Subject").fill("Example leaking tap");
  await page.getByRole("radio", { name: "Apartment", exact: true }).check();
  const apartment = page.getByRole("combobox", { name: "Apartment" });
  await apartment.selectOption({ index: 1 });
  const apartmentValue = await apartment.inputValue();

  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByText("Due date cannot be before the start date.")).toBeVisible();

  await expect(caseType).toHaveValue(typeValue);
  await expect(page.getByLabel("Start date")).toHaveValue("18/11/2026");
  await expect(page.getByLabel("Due date")).toHaveValue("01/11/2026");
  await expect(page.getByLabel("Subject")).toHaveValue("Example leaking tap");
  await expect(page.getByRole("radio", { name: "Apartment", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Not applicable" })).not.toBeChecked();
  await expect(apartment).toHaveValue(apartmentValue);

  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.locator("form.form-card").screenshot({ path: path.join(artifacts, "case-form-validation.png") });
});

test("new case keeps the asset job area when no asset is chosen", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/cases/new");

  const caseType = page.getByLabel("Case type");
  await caseType.selectOption({ label: "Repair & maintenance" });
  const typeValue = await caseType.inputValue();
  await page.getByLabel("Subject").fill("Example plant room check");
  await page.getByRole("radio", { name: "Asset", exact: true }).check();
  await expect(page.getByLabel("Asset category")).toBeVisible();

  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByText("Choose at least one asset.")).toBeVisible();

  await expect(caseType).toHaveValue(typeValue);
  await expect(page.getByLabel("Subject")).toHaveValue("Example plant room check");
  await expect(page.getByRole("radio", { name: "Asset", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Not applicable" })).not.toBeChecked();
  await expect(page.getByLabel("Asset category")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Fire pump 1" })).not.toBeChecked();
});

test("new resident keeps email and type when the name is too long", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/residents/new");
  await expect(page.getByRole("heading", { name: "New resident" })).toBeVisible();

  const longName = "Example".repeat(12);
  const apartment = page.getByLabel("Apartment");
  await apartment.selectOption({ index: 1 });
  const apartmentValue = await apartment.inputValue();
  await page.getByLabel("First name").fill(longName);
  await page.getByLabel("Last name").fill("Example");
  const residentType = page.getByLabel("Resident type");
  await residentType.selectOption({ label: "Tenant" });
  await page.getByLabel("Email").fill("resident.example@example.com");

  await page.getByRole("button", { name: "Save resident" }).click();
  await expect(page.getByText("Use 80 characters or fewer.")).toBeVisible();

  await expect(page.getByLabel("First name")).toHaveValue(longName);
  await expect(page.getByLabel("Last name")).toHaveValue("Example");
  await expect(page.getByLabel("Email")).toHaveValue("resident.example@example.com");
  await expect(residentType).toHaveValue("tenant");
  await expect(apartment).toHaveValue(apartmentValue);
});

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
