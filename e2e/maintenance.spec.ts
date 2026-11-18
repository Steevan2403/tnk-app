import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";
const subject = "Example monthly stair light test";

test("admin schedules monthly maintenance, completes a visit, and opens a case from an overdue one", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  const today = sydneyToday();
  const day = Math.min(Number(today.slice(8)), 25);
  const start = monthDate(today, -2, day);
  const occurrence = monthDate(today, 0, day);

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  const switcher = page.getByRole("button", { name: /Switch building/ });
  if (!(await switcher.innerText()).includes("Example Tower")) {
    await switcher.click();
    await page
      .locator("aside")
      .getByRole("button", { name: "Example Tower 100 Example Street, Sydney NSW 2000", exact: true })
      .click();
    await expect(switcher).toContainText("Example Tower");
  }

  await page.goto("/maintenance/new");
  await expect(page.getByRole("heading", { name: "New maintenance" })).toBeVisible();
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel("Description").fill("Example monthly check of the stair lights.");
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("Frequency").selectOption({ label: "Monthly" });
  await expect(page.getByLabel("No end date")).toBeChecked();
  await page.getByRole("checkbox", { name: "Fictional Fire Services" }).check();
  await page.getByRole("checkbox", { name: "Avery Sample" }).check();

  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "maintenance-form-desktop.png");
  await page.getByRole("button", { name: "Save maintenance" }).click();

  await expect(page).toHaveURL(/tab=overdue/);
  await expect(page.getByRole("heading", { name: "Maintenance" })).toBeVisible();
  await expect(page.getByRole("link", { name: subject })).toBeVisible();
  await page.setViewportSize({ width: 1680, height: 1100 });
  await shot(page, "maintenance-overdue-desktop.png");

  await page.getByRole("link", { name: "Active", exact: true }).click();
  await expect(page.getByRole("link", { name: "Example gutter clean" })).toBeVisible();
  await shot(page, "maintenance-active-desktop.png");

  await page.getByRole("link", { name: "Completed", exact: true }).click();
  await expect(page.getByRole("link", { name: "Example lobby camera check" })).toBeVisible();
  await shot(page, "maintenance-completed-desktop.png");

  await page.getByRole("link", { name: "Active", exact: true }).click();
  await expect(page.getByRole("link", { name: "Example gutter clean" })).toBeVisible();
  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page).toHaveURL(/view=timeline/);
  await expect(page.getByRole("link", { name: "Example gutter clean" })).toBeVisible();
  await shot(page, "maintenance-timeline-desktop.png");

  await page.getByRole("link", { name: "Overdue", exact: true }).click();
  await expect(page).toHaveURL(/tab=overdue/);
  await page.getByRole("link", { name: "List", exact: true }).click();
  await expect(page).not.toHaveURL(/view=timeline/);
  await expect(page.getByRole("link", { name: subject })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "maintenance-overdue-mobile.png");

  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.goto(`/calendar?date=${occurrence}`);
  await expect(page.getByRole("link", { name: subject })).toBeVisible();
  await shot(page, "calendar-month-desktop.png");

  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.getByRole("link", { name: subject })).toBeVisible();
  await shot(page, "calendar-week-desktop.png");

  await page.getByRole("link", { name: "Agenda", exact: true }).click();
  await expect(page.getByRole("link", { name: subject })).toBeVisible();
  await shot(page, "calendar-agenda-desktop.png");

  const panel = page.getByRole("complementary", { name: "Occurrence" });
  await page.goto(`/calendar?date=${occurrence}`);
  await page.getByRole("link", { name: subject }).click();
  await expect(panel.getByRole("heading", { name: subject })).toBeVisible();
  await shot(page, "calendar-occurrence-desktop.png");
  await panel.getByLabel("Note").fill("Example stair lights checked.");
  await panel.getByRole("button", { name: "Mark complete" }).click();
  await expect(panel.getByText("Completed")).toBeVisible();

  const previous = monthDate(today, -1, day);
  await page.goto(`/calendar?date=${previous}`);
  await page.getByRole("link", { name: subject }).click();
  await expect(panel.getByText("Overdue")).toBeVisible();
  await panel.getByRole("link", { name: "Create case" }).click();

  await expect(page.getByRole("heading", { name: "New case" })).toBeVisible();
  await expect(page.getByLabel("Subject")).toHaveValue(subject);
  await expect(page.getByLabel("Case type").locator("option:checked")).toHaveText("Repair & maintenance");
  await expect(page.getByRole("checkbox", { name: "Fictional Fire Services", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save case" }).click();

  await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
  await expect(page.getByText(/From maintenance/)).toBeVisible();
});

function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthDate(iso: string, months: number, day: number): string {
  const [year, month] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  const chosen = Math.min(day, last);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), chosen)).toISOString().slice(0, 10);
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
