import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

test("admin adds an asset with a company, contact, and expired warranty; staff cannot add an asset", async ({
  page,
}) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fire pump 1" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Fire pump 1/ }).getByText("15 Jan 2024", { exact: true })).toHaveClass(/text-danger/);
  await expect(page.getByRole("row", { name: /Passenger lift A/ }).getByText("30 June 2028", { exact: true })).not.toHaveClass(/text-danger/);

  await page.setViewportSize({ width: 1680, height: 1000 });
  await shot(page, "assets-list-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "assets-list-mobile.png");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("link", { name: "New asset" }).click();
  await expect(page.getByRole("heading", { name: "New asset" })).toBeVisible();
  await page.getByLabel("Asset name").fill("Sump pump 2");
  await page.getByLabel("Category").selectOption({ label: "Pumps" });
  await page.getByLabel("Location").fill("Basement");
  await page.getByLabel("Make").fill("Example");
  await page.getByLabel("Model").fill("SP-2");
  await page.getByLabel("Serial number").fill("SN-SP-777");
  await page.getByLabel("Date of purchase").fill("2024-05-01");
  await page.getByLabel("Asset value").fill("2500");
  await page.getByLabel("End-of-life value").fill("200");
  await page.getByLabel("Estimated life (months)").fill("120");
  await page.getByLabel("Service company").selectOption({ label: "Sample Plumbing Co" });
  await page.getByLabel("Contact").selectOption({ label: "Casey Placeholder" });
  await shot(page, "assets-form-desktop.png");
  await page.getByRole("button", { name: "Save asset" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Sump pump 2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Plumbing Co" })).toBeVisible();
  await expect(page.getByText("Casey Placeholder")).toBeVisible();

  await page.getByLabel("Provider").fill("Example Warranty Co");
  await page.getByLabel("Start date").fill("2019-01-01");
  await page.getByLabel("Expiry date").fill("2020-01-01");
  await page.getByLabel("Notes").fill("Expired example cover");
  await page.getByRole("button", { name: "Add warranty" }).click();

  const expired = page.getByText("1 Jan 2020", { exact: true });
  await expect(expired).toBeVisible();
  await expect(expired).toHaveClass(/text-danger/);
  const qr = page.getByRole("img", { name: "QR code for Sump pump 2" });
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 1900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "assets-detail-desktop.png");
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByRole("link", { name: "All assets" }).click();
  await expect(page.getByRole("row", { name: /Sump pump 2/ }).getByText("1 Jan 2020", { exact: true })).toHaveClass(/text-danger/);

  await page.getByRole("link", { name: "Sump pump 2" }).click();
  await page.getByRole("link", { name: "Print label" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sump pump 2" })).toBeVisible();
  await expect(page.locator("main").getByText("Example Tower")).toBeVisible();
  const label = page.getByRole("img", { name: "QR code for Sump pump 2" });
  await expect(label).toBeVisible();
  await expect.poll(() => label.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await shot(page, "assets-label-desktop.png");

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New asset" })).toHaveCount(0);
  await expect(page.getByText("Asset categories")).toHaveCount(0);

  await page.goto("/building/assets/new");
  await expect(page).toHaveURL(/\/building\/assets$/);
  await expect(page.getByRole("link", { name: "New asset" })).toHaveCount(0);
});

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
}
