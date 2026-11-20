import { expect, test, type Page } from "@playwright/test";

test("dates are written day first while the page language is Australian", async ({ page }) => {
  await signIn(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-AU");

  await page.goto("/cases/new");
  const start = page.getByLabel("Start date");
  await expect(start).toHaveAttribute("lang", "en-AU");
  await expect(start).toHaveAttribute("placeholder", "DD/MM/YYYY");
  await expect(start).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  await start.fill("19/11/2026");
  await expect(start).toHaveValue("19/11/2026");
  await expect(page.locator("input[type=hidden][name=startDate]")).toHaveValue("2026-11-19");
  await start.fill("2026-12-01");
  await expect(start).toHaveValue("01/12/2026");

  await page.goto("/cases");
  await expect(page.getByLabel("Start from")).toHaveAttribute("placeholder", "DD/MM/YYYY");

  await page.goto("/cases/305/work-order");
  const attending = page.getByLabel("Attending");
  await expect(attending).toHaveAttribute("placeholder", "DD/MM/YYYY HH:MM");
  await attending.fill("19/11/2026 09:30");
  await expect(attending).toHaveValue("19/11/2026 09:30");
  await expect(page.locator("input[type=hidden][name=attendingAt]")).toHaveValue("2026-11-19T09:30");
});

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-AU");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
