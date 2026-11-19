import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";
const longTitle =
  "Example long Sunday check of stairwell emergency lighting, exit signs, handrails, and door closers across the building";

test("month columns are equal width and Sunday stays on screen", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  const sunday = firstSunday(sydneyToday());
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.goto("/maintenance/new");
  await page.getByLabel("Subject").fill(longTitle);
  await page.getByLabel("Description").fill("Example check used to confirm a long title stays inside its day.");
  await page.getByLabel("Start date").fill(sunday);
  await page.getByLabel("Frequency").selectOption({ label: "One-off" });
  await page.getByRole("button", { name: "Save maintenance" }).click();
  await expect(page.getByRole("link", { name: longTitle })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/calendar?date=${sunday}`);
  const grid = page.getByRole("grid", { name: "Month" });
  await expect(grid).toBeVisible();
  await expect(page.getByRole("link", { name: longTitle })).toBeVisible();
  await expect(page.getByText("Upcoming", { exact: true })).toBeVisible();
  await expect(page.getByText("Work order", { exact: true })).toBeVisible();

  const headers = page.getByRole("columnheader");
  await expect(headers).toHaveCount(7);
  const widths = await headers.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  const gridBox = await grid.boundingBox();
  expect(gridBox).not.toBeNull();
  const span = widths.reduce((total, width) => total + width, 0);
  expect(Math.abs(span - gridBox!.width)).toBeLessThanOrEqual(8);
  expect(gridBox!.width).toBeGreaterThan(800);

  const link = page.getByRole("link", { name: longTitle });
  expect(await link.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(true);

  const show = page.getByLabel("Show");
  await show.getByRole("link", { name: "Maintenance" }).click();
  await expect(page.getByRole("link", { name: longTitle })).toHaveCount(0);
  await show.getByRole("link", { name: "Maintenance" }).click();
  await expect(page.getByRole("link", { name: longTitle })).toBeVisible();

  await shot(page, "calendar-grid-1280.png");

  await page.setViewportSize({ width: 400, height: 800 });
  const sundayHeading = page.getByRole("heading", { name: /^Sunday/ }).first();
  await sundayHeading.scrollIntoViewIfNeeded();
  await expect(sundayHeading).toBeVisible();
  const headingBox = await sundayHeading.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.x).toBeGreaterThanOrEqual(0);
  expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(400);
  await expect(page.getByRole("link", { name: longTitle })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await shot(page, "calendar-grid-400.png");
});

function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function firstSunday(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  for (let day = 1; day <= 7; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCDay() === 0) return date.toISOString().slice(0, 10);
  }
  return iso;
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
  await page.screenshot({ path: path.join(artifacts, name) });
}
