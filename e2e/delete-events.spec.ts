import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";
const eventSubject = "Example stair light delete";
const templateName = "Example delete checklist";

test("admin deletes a visit or a series, and a template, and staff cannot", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  const today = sydneyToday();
  const day = Math.min(Number(today.slice(8)), 25);
  const start = monthDate(today, -2, day);
  const thisVisit = monthDate(today, 0, day);
  const previousVisit = monthDate(today, -1, day);

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);

  await page.goto("/maintenance/new");
  await page.getByLabel("Subject").fill(eventSubject);
  await page.getByLabel("Description").fill("Example monthly check used to test delete.");
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("Frequency").selectOption({ label: "Monthly" });
  await page.getByRole("checkbox", { name: "Fictional Fire Services" }).check();
  await page.getByRole("checkbox", { name: "Avery Sample" }).check();
  await page.getByRole("button", { name: "Save maintenance" }).click();
  await expect(page.getByRole("link", { name: eventSubject })).toBeVisible();

  await page.goto(`/calendar?date=${thisVisit}`);
  const panel = page.getByRole("complementary", { name: "Occurrence" });
  await visitLink(page, eventSubject).click();
  await expect(panel.getByRole("heading", { name: eventSubject })).toBeVisible();
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  const eventDialog = panel.getByRole("dialog");
  await expect(eventDialog).toContainText("Choose this visit only, or the whole series.");
  await expect(eventDialog).toContainText("The other visits stay.");
  await expect(eventDialog).toContainText("No cases were opened from this visit.");
  await expect(eventDialog).toContainText("No cases were opened from this series.");
  await eventDialog.scrollIntoViewIfNeeded();
  await shot(page, "delete-event-confirmation.png");
  await eventDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(eventDialog).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: eventSubject })).toBeVisible();

  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await eventDialog.getByRole("button", { name: "Delete this visit" }).click();
  await expect(visitLink(page, eventSubject)).toHaveCount(0);

  await page.goto("/dashboard");
  const activity = page.getByRole("region", { name: "Recent activity" });
  await expect(activity.getByRole("link", { name: `Deleted the ${dateLabel(thisVisit)} visit of ${eventSubject}. Other visits were kept.` })).toBeVisible();

  await page.goto(`/calendar?date=${previousVisit}`);
  await visitLink(page, eventSubject).click();
  await expect(panel.getByRole("heading", { name: eventSubject })).toBeVisible();
  await panel.getByRole("link", { name: "Create case" }).click();
  await expect(page.getByLabel("Subject")).toHaveValue(eventSubject);
  await page.getByLabel("Priority").selectOption({ label: "Low" });
  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByRole("heading", { level: 1, name: eventSubject })).toBeVisible();
  await expect(page.getByText("From maintenance")).toBeVisible();
  const caseUrl = page.url();

  await page.goto(`/calendar?date=${previousVisit}`);
  await visitLink(page, eventSubject).click();
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(eventDialog).toContainText("1 case already opened from this visit stays, including its work orders.");
  await expect(eventDialog).toContainText("1 case already opened from this series stays, including its work orders.");
  await eventDialog.getByRole("button", { name: "Delete whole series" }).click();
  await expect(page).toHaveURL(/\/maintenance/);
  await expect(page.getByRole("link", { name: eventSubject, exact: true })).toHaveCount(0);

  await page.goto(caseUrl);
  await expect(page.getByRole("heading", { level: 1, name: eventSubject })).toBeVisible();
  await expect(page.getByText("From maintenance")).toHaveCount(0);

  await page.goto(`/calendar?date=${previousVisit}`);
  await expect(visitLink(page, eventSubject)).toHaveCount(0);
  await expect(page.getByRole("link", { name: eventSubject, exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(activity.getByRole("link", { name: `Deleted maintenance event ${eventSubject}. 1 case already opened from it was kept, including its work orders.` })).toBeVisible();

  await page.goto("/building/inspections/templates/new");
  await page.getByLabel("Name", { exact: true }).fill(templateName);
  await page.getByLabel("Description").fill("Example checklist used to test delete.");
  await page.getByLabel("Area name").first().fill("Plant room");
  await page.getByLabel("Item", { exact: true }).first().fill("Pump seals");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("link", { name: templateName, exact: true })).toBeVisible();
  const templateHref = await page.getByRole("link", { name: templateName, exact: true }).getAttribute("href");
  expect(templateHref).toBeTruthy();

  await page.getByRole("link", { name: `Start inspection ${templateName}` }).click();
  await page.getByRole("button", { name: "Start inspection" }).click();
  await expect(page.getByRole("heading", { name: templateName })).toBeVisible();
  const runUrl = page.url();
  await page.getByRole("button", { name: "Pass Pump seals" }).click();
  await expect(page.getByRole("button", { name: "Pass Pump seals" })).toHaveAttribute("aria-pressed", "true");

  await page.goto(templateHref!);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const templateDialog = page.getByRole("dialog");
  await expect(templateDialog).toContainText("1 in progress inspection keeps its checklist, answers, photos, and any case raised from it. That record stays.");
  await templateDialog.scrollIntoViewIfNeeded();
  await shot(page, "delete-template-confirmation.png");
  await templateDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Edit template" })).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await templateDialog.getByRole("button", { name: "Delete template" }).click();
  await expect(page.getByRole("heading", { name: "Inspections" })).toBeVisible();
  await expect(page.getByRole("link", { name: templateName, exact: true })).toHaveCount(0);

  await page.goto(runUrl);
  await expect(page.getByRole("heading", { name: templateName })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass Pump seals" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/dashboard");
  await expect(
    activity.getByRole("link", {
      name: `Deleted inspection template ${templateName}. 1 in progress inspection kept its checklist, answers, photos, and any case raised from it.`,
    }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await selectExampleTower(page);
  await page.goto(`/calendar?date=${monthDate(today, 0, 15)}`);
  await page.getByRole("link", { name: "Example fire system test", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Example fire system test" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);

  await page.goto("/building/inspections/templates/seed_insp_tpl_roof");
  await expect(page.getByRole("heading", { name: "Inspections" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(page.getByRole("table").getByText("Example roof inspection")).toBeVisible();
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

function visitLink(page: Page, subject: string) {
  return page.locator("a[href*='event=']").filter({ hasText: subject, visible: true });
}

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

async function signOut(page: Page) {
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
