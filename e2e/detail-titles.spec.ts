import { expect, test, type Page } from "@playwright/test";

const towerButton = "Example Tower 100 Example Street, Sydney NSW 2000";
const courtButton = "Sample Court 8 Sample Road, Pyrmont NSW 2009";

test("a cross-building detail page stays not found without naming the record", async ({ page }) => {
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  try {
    await selectBuilding(page, "Example Tower", towerButton);
    await page.goto("/residents/apartments/seed_apt_101");
    await expect(page.getByRole("heading", { level: 1, name: "101" })).toBeVisible();
    await expect(page).toHaveTitle("101 · TNK Building Manager");

    await selectBuilding(page, "Sample Court", courtButton);
    await expectHidden(page, "/residents/apartments/seed_apt_101", "Apartment", "101");
    await expectHidden(page, "/cases/300", "Case", "Example fire pump drip");
    await expectHidden(page, "/work-orders/seed_wo_01a", "Work order", "Example fire pump drip");
    await expectHidden(page, "/building/assets/seed_asset_fire_pump", "Asset", "Fire pump 1");
    await expectHidden(page, "/building/assets/seed_asset_fire_pump/label", "Asset label", "Fire pump 1");
    await expectHidden(page, "/building/inspections/runs/seed_insp_run_open", "Inspection", "Monthly common area inspection");
    await page.goto("/contractors/missing-company-id");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page).toHaveTitle("Company · TNK Building Manager");
  } finally {
    await selectBuilding(page, "Example Tower", towerButton);
  }
});

async function expectHidden(page: Page, path: string, title: string, leaked: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page).toHaveTitle(`${title} · TNK Building Manager`);
  await expect(page).not.toHaveTitle(new RegExp(leaked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

async function selectBuilding(page: Page, name: string, buttonName: string) {
  const switcher = page.getByRole("button", { name: /Switch building/ });
  if (!(await switcher.isVisible().catch(() => false))) return;
  if ((await switcher.innerText()).includes(name)) return;
  await switcher.click();
  await page.locator("aside").getByRole("button", { name: buttonName, exact: true }).click();
  await expect(switcher).toContainText(name);
}

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
