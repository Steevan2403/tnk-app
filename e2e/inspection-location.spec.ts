import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";

test("a failed inspection item carries the chosen asset onto the case", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.goto("/building/inspections/templates/seed_insp_tpl_common/start");
  await expect(page.getByRole("heading", { name: "Start inspection" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "N/A" })).toBeChecked();

  await page.getByRole("radio", { name: "Common asset" }).check();
  await page.getByRole("checkbox", { name: /Passenger lift A/ }).check();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "inspection-location-start.png");
  await page.getByRole("button", { name: "Start inspection" }).click();

  await expect(page.getByRole("heading", { name: "Monthly common area inspection" })).toBeVisible();
  await expect(page.getByText("Common asset · Passenger lift A")).toBeVisible();
  await page.getByRole("button", { name: "Fail Lobby floor" }).click();
  await expect(page.getByRole("button", { name: "Fail Lobby floor" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("article", { name: "Lobby floor" }).getByRole("button", { name: "Create case for Lobby floor" }).click();

  const caseLink = page.getByRole("article", { name: "Lobby floor" }).getByRole("link", { name: /^Case #\d+$/ });
  await expect(caseLink).toBeVisible();
  await caseLink.click();
  await expect(page.getByRole("heading", { level: 1, name: "Lobby floor (Lobby)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Passenger lift A" })).toBeVisible();
  await expect(page.getByText("Common asset", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "inspection-location-case.png");
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
