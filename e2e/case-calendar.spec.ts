import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";

test("an admin adds a case to the calendar once", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.goto("/cases/300");
  await expect(page.getByRole("heading", { level: 1, name: "Example fire pump drip" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "case-calendar-add.png");
  await page.getByRole("button", { name: "Add to calendar" }).click();

  const onCalendar = page.getByRole("link", { name: "On calendar" });
  await expect(onCalendar).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to calendar" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "On calendar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to calendar" })).toHaveCount(0);
  await shot(page, "case-calendar-linked.png");

  await page.getByRole("link", { name: "On calendar" }).click();
  await expect(page.getByRole("link", { name: "Case #300" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Example fire pump drip" })).toBeVisible();
  await shot(page, "case-calendar-event.png");
  await page.goto("/calendar?date=2026-10-08&kinds=maintenance");
  await expect(page.getByRole("link", { name: "Example fire pump drip" })).toHaveCount(1);

  await signOut(page);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await selectExampleTower(page);
  await page.goto("/cases/300");
  await expect(page.getByRole("heading", { level: 1, name: "Example fire pump drip" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to calendar" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "On calendar" })).toHaveCount(0);
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
