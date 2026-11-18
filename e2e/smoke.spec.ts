import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

test("signs in, creates a building, and opens it on the dashboard", async ({ page }) => {
  mkdirSync(shots, { recursive: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.screenshot({ path: path.join(shots, "sign-in-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(shots, "sign-in-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Example Tower" })).toBeVisible();
  await expect(page.getByRole("main").getByText("100 Example Street, Sydney NSW 2000")).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, "dashboard-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Cases" })).toBeVisible();
  await page.screenshot({ path: path.join(shots, "dashboard-mobile.png"), fullPage: false });
  await page.getByRole("button", { name: "Close" }).click();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: /Switch building/ }).click();
  await page.getByRole("link", { name: "Manage buildings" }).click();
  await expect(page.getByRole("heading", { name: "Buildings" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Example Tower/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Sample Court/ })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, "buildings-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(shots, "buildings-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  const name = `Smoke Test Residences ${Date.now()}`;
  await page.getByRole("link", { name: "New building" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Street address").fill("15 Test Lane");
  await page.getByLabel("Suburb").fill("Surry Hills");
  await page.getByLabel("State").selectOption("NSW");
  await page.getByLabel("Postcode").fill("2010");
  await page.getByLabel("Lot count").fill("12");
  await page.getByRole("button", { name: "Save building" }).click();

  await expect(page.getByRole("heading", { name: "Buildings" })).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(name) })).toBeVisible();

  await page.getByRole("button", { name: /Switch building/ }).click();
  await page.locator("aside").getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("main").getByText("15 Test Lane, Surry Hills NSW 2010")).toBeVisible();
});
