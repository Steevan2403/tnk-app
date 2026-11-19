import { expect, test, type Page } from "@playwright/test";

test("narrow case list collapses filters, shows the status bar after a selection, and snaps board columns", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();

  const filters = page.getByRole("button", { name: "Filters, 0 active" });
  await expect(filters).toBeVisible();
  await expect(filters).toContainText("0");
  await expect(page.getByLabel("Search cases")).toBeHidden();
  await expect(page.getByLabel("Type")).toBeHidden();
  await filters.click();
  await expect(page.getByLabel("Search cases")).toBeVisible();
  await expect(page.getByLabel("Contractor")).toBeVisible();
  await expect(page.getByLabel("Start from")).toBeVisible();
  await expect(page.getByLabel("Start to")).toBeVisible();
  await filters.click();
  await expect(page.getByLabel("Search cases")).toBeHidden();

  await expect(page.getByRole("button", { name: "Update selected" })).toHaveCount(0);
  const row = page.getByRole("checkbox", { name: /Select case/ }).first();
  const rowBox = await row.boundingBox();
  expect(rowBox).not.toBeNull();
  expect(rowBox!.width).toBeGreaterThanOrEqual(44);
  expect(rowBox!.height).toBeGreaterThanOrEqual(44);
  const star = page.getByRole("button", { name: /Star case|Unstar case/ }).first();
  const starBox = await star.boundingBox();
  expect(starBox).not.toBeNull();
  expect(starBox!.width).toBeGreaterThanOrEqual(44);
  expect(starBox!.height).toBeGreaterThanOrEqual(44);

  await row.check();
  await expect(page.getByRole("button", { name: "Update selected" })).toBeVisible();
  await expect(page.getByLabel("Change status")).toBeVisible();
  await row.uncheck();
  await expect(page.getByRole("button", { name: "Update selected" })).toHaveCount(0);

  await page.getByRole("link", { name: "Board", exact: true }).click();
  const board = page.locator("[data-case-board]");
  await expect(board).toBeVisible();
  await expect
    .poll(async () => board.evaluate((element) => getComputedStyle(element).scrollSnapType))
    .toMatch(/x/);
  const heading = page.getByRole("heading", { name: /In progress \(\d+\)/ });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(false);
  const boardBox = await board.boundingBox();
  const columnBox = await page.getByRole("region", { name: "In progress" }).boundingBox();
  expect(boardBox).not.toBeNull();
  expect(columnBox).not.toBeNull();
  expect(columnBox!.width).toBeLessThan(boardBox!.width - 12);
  expect(columnBox!.width).toBeGreaterThanOrEqual(256);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/cases");
  const desktopBox = await page.getByRole("checkbox", { name: /Select case/ }).first().boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(desktopBox!.width).toBeLessThan(24);
  await expect(page.getByRole("button", { name: /Filters,/ })).toBeHidden();
  await expect(page.getByLabel("Search cases")).toBeVisible();
});

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
