import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, type Locator, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";
const tower = "Example Tower";
const court = "Sample Court";
const towerButton = "Example Tower 100 Example Street, Sydney NSW 2000";
const courtButton = "Sample Court 8 Sample Road, Pyrmont NSW 2009";
const admin = { email: "admin@tnk.example", password: "example-admin-pass" };
const manager = { email: "manager@tnk.example", password: "example-manager-pass" };
const notice = Buffer.from("Example notice for Sample Court.\n");

test("a manager sees only assigned buildings, and an admin can change that", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(artifacts, { recursive: true });
  let restoreAdmin = false;

  try {
    await signIn(page, admin.email, admin.password);
    restoreAdmin = true;
    const record = await createCourtApartment(page);

    await page.goto("/settings/users");
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
    const managerForm = personForm(page, "Example Manager");
    const staffForm = personForm(page, "Example Staff");
    await expect(managerForm.getByRole("checkbox", { name: tower })).toBeChecked();
    await expect(managerForm.getByRole("checkbox", { name: court })).not.toBeChecked();
    await expect(staffForm.getByRole("checkbox", { name: tower })).toBeChecked();
    await expect(staffForm.getByRole("checkbox", { name: court })).toBeChecked();
    await page.screenshot({ path: path.join(artifacts, "building-membership-editor.png"), fullPage: true });

    await managerForm.getByRole("checkbox", { name: court }).check();
    await managerForm.getByRole("button", { name: "Save buildings" }).click();
    await expect(personForm(page, "Example Manager").getByRole("checkbox", { name: court })).toBeChecked();
    await expect(personForm(page, "Example Staff").getByRole("checkbox", { name: court })).toBeChecked();

    await signOut(page);
    await signIn(page, manager.email, manager.password);
    await openSwitcher(page);
    await expect(page.locator("aside").getByRole("button", { name: courtButton, exact: true })).toBeVisible();

    await signOut(page);
    await signIn(page, admin.email, admin.password);
    await page.goto("/settings/users");
    await personForm(page, "Example Manager").getByRole("checkbox", { name: court }).uncheck();
    await personForm(page, "Example Manager").getByRole("button", { name: "Save buildings" }).click();
    await expect(personForm(page, "Example Manager").getByRole("checkbox", { name: court })).not.toBeChecked();
    await expect(personForm(page, "Example Manager").getByRole("checkbox", { name: tower })).toBeChecked();

    await signOut(page);
    await signIn(page, manager.email, manager.password);
    await openSwitcher(page);
    await expect(page.locator("aside").getByRole("button", { name: towerButton, exact: true })).toBeVisible();
    await expect(page.locator("aside").getByText(court)).toHaveCount(0);
    await page.locator("aside").screenshot({ path: path.join(artifacts, "limited-building-switcher.png") });

    await page.goto("/buildings");
    await expect(page.getByText(tower).first()).toBeVisible();
    await expect(page.getByText(court)).toHaveCount(0);

    await page.goto("/settings/users");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    await page.goto("/dashboard");
    await openSwitcher(page);
    const posted = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/dashboard"),
    );
    await page.locator("aside form").evaluate((form, buildingId) => {
      form.addEventListener(
        "submit",
        () => {
          const input = form.querySelector("input[name='buildingId']");
          if (input instanceof HTMLInputElement) input.value = buildingId;
        },
        true,
      );
    }, "seed_sample_court");
    await page.locator("aside").getByRole("button", { name: towerButton, exact: true }).click();
    expect((await posted).status()).toBe(404);

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Switch building/ })).toContainText(tower);
    await expect(page.getByRole("button", { name: /Switch building/ })).not.toContainText(court);

    await page.goto(record.apartmentHref);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const blocked = await page.request.get(record.fileHref, { maxRedirects: 0 });
    expect(blocked.status()).toBe(404);
    expect(await blocked.text()).toBe("Not found");

    setSelectedBuilding(manager.email, "seed_sample_court");
    await page.goto(record.apartmentHref);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const stale = await page.request.get(record.fileHref, { maxRedirects: 0 });
    expect(stale.status()).toBe(404);
    expect(await stale.text()).toBe("Not found");
    setSelectedBuilding(manager.email, "seed_example_tower");

    await signOut(page);
    await signIn(page, admin.email, admin.password);
    await openSwitcher(page);
    await expect(page.locator("aside").getByRole("button", { name: courtButton, exact: true })).toBeVisible();
    await expect(page.locator("aside").getByRole("button", { name: towerButton, exact: true })).toBeVisible();
    await selectBuilding(page, court, courtButton);
    await page.goto(record.apartmentHref);
    await expect(page.getByRole("heading", { level: 1, name: "9" })).toBeVisible();
    const allowed = await page.request.get(record.fileHref, { maxRedirects: 0 });
    expect(allowed.status()).toBe(200);
    expect(Buffer.compare(await allowed.body(), notice)).toBe(0);

    await page.goto("/settings/users");
    await personForm(page, "Example Manager").getByRole("checkbox", { name: tower }).uncheck();
    await personForm(page, "Example Manager").getByRole("checkbox", { name: court }).uncheck();
    await personForm(page, "Example Manager").getByRole("button", { name: "Save buildings" }).click();
    await expect(personForm(page, "Example Manager").getByRole("checkbox", { name: tower })).not.toBeChecked();

    await signOut(page);
    await signIn(page, manager.email, manager.password);
    await expect(
      page.getByRole("heading", { name: "You haven't been given access to a building yet, ask an admin" }),
    ).toBeVisible();
    await page.goto(record.apartmentHref);
    await expect(
      page.getByRole("heading", { name: "You haven't been given access to a building yet, ask an admin" }),
    ).toBeVisible();

    await signOut(page);
    await signIn(page, admin.email, admin.password);
    await page.goto("/settings/users");
    await personForm(page, "Example Manager").getByRole("checkbox", { name: tower }).check();
    await personForm(page, "Example Manager").getByRole("button", { name: "Save buildings" }).click();
    await expect(personForm(page, "Example Manager").getByRole("checkbox", { name: tower })).toBeChecked();
    await expect(personForm(page, "Example Manager").getByRole("checkbox", { name: court })).not.toBeChecked();
    await selectBuilding(page, tower, towerButton);
    restoreAdmin = false;
  } finally {
    setSelectedBuilding(manager.email, "seed_example_tower");
    if (restoreAdmin) {
      await signOut(page).catch(() => undefined);
      await signIn(page, admin.email, admin.password).catch(() => undefined);
      await selectBuilding(page, tower, towerButton);
    }
  }
});

function personForm(page: Page, name: string): Locator {
  return page.locator("form").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

async function createCourtApartment(page: Page) {
  await selectBuilding(page, court, courtButton);
  await page.goto("/residents?tab=apartments");
  await page.getByRole("button", { name: "New apartment" }).click();
  await page.getByLabel("Apartment number").fill("9");
  await page.getByLabel("Lot number").fill("90");
  await page.getByRole("button", { name: "Save apartment" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "9" })).toBeVisible();
  const apartmentHref = new URL(page.url()).pathname;

  await page.goto(`${apartmentHref}?tab=documents`);
  await page.getByLabel("Document name").fill("Example notice");
  await page.getByLabel("File").setInputFiles({
    name: "example-notice.txt",
    mimeType: "text/plain",
    buffer: notice,
  });
  await page.getByRole("button", { name: "Upload document" }).click();
  const documentLink = page.getByRole("listitem").filter({ hasText: "Example notice" }).getByRole("link", { name: "Download" });
  await expect(documentLink).toBeVisible();
  const fileHref = await documentLink.getAttribute("href");
  expect(fileHref).toMatch(/^\/api\/resident-files\/documents\//);
  return { apartmentHref, fileHref: fileHref! };
}

function setSelectedBuilding(email: string, buildingId: string) {
  const db = new DatabaseSync("prisma/e2e.db");
  try {
    db.prepare("UPDATE User SET selectedBuildingId = ? WHERE email = ?").run(buildingId, email);
  } finally {
    db.close();
  }
}

async function openSwitcher(page: Page) {
  const switcher = page.getByRole("button", { name: /Switch building/ });
  await switcher.click();
  await expect(page.locator("aside form").first()).toBeVisible();
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
  await expect(page).not.toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function signOut(page: Page) {
  const menu = page.locator("header summary");
  if (await menu.isVisible().catch(() => false)) await menu.click();
  const button = page.getByRole("button", { name: "Sign out" });
  if (!(await button.isVisible().catch(() => false))) return;
  await button.click();
  await expect(page).toHaveURL(/\/sign-in$/);
}
