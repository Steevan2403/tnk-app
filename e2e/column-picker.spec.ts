import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";

test("column choices stay hidden after a reload", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/cases");
  await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Subject/ })).toBeVisible();

  await page.getByRole("button", { name: "Columns" }).click();
  await expect(page.getByRole("checkbox", { name: "Type" })).toBeChecked();
  await shot(page, "column-picker-cases.png");
  await page.getByRole("checkbox", { name: "Type" }).uncheck();
  await expect(page.getByRole("columnheader", { name: "Type" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: /Case #/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Subject/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Type" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: /Subject/ })).toBeVisible();
  const caseKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("tnk-columns:") && key.endsWith(":cases")));
  expect(caseKeys).toHaveLength(1);

  await page.goto("/work-orders");
  await expect(page.getByRole("columnheader", { name: "Contact" })).toBeVisible();
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("checkbox", { name: "Contact" }).uncheck();
  await expect(page.getByRole("columnheader", { name: "Contact" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Work order" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Case subject" })).toBeVisible();
  await shot(page, "column-picker-work-orders.png");
  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Contact" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Case subject" })).toBeVisible();
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

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
  await page.screenshot({ path: path.join(artifacts, name), fullPage: true });
}
