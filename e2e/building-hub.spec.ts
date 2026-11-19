import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

const TILES = [
  "Assets",
  "Inspections",
  "Maintenance",
  "Management reports",
  "Residents and apartments",
  "Contractors",
  "Categories",
] as const;

test("building hub lists sections, highlights Building, and keeps old category URLs", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });
  await signIn(page, "admin@tnk.example", "example-admin-pass");

  await page.goto("/building");
  await expect(page.getByRole("heading", { name: "Building", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);

  const sections = page.getByRole("region", { name: "Building sections" });
  await expect(sections.getByRole("link")).toHaveCount(TILES.length);
  for (const label of TILES) {
    const tile = sections.getByRole("link", { name: new RegExp(`^${label}\\b`) });
    await expect(tile).toBeVisible();
    await expect(tile).toContainText(/\d/);
  }
  await expect(sections.getByText("Equipment and plant registered at this building.")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Building", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Assets", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Inspections", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Reports", exact: true })).toHaveCount(0);
  for (const label of ["Dashboard", "Cases", "Work Orders", "Calendar", "Maintenance", "Residents", "Contractors", "Settings"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.mouse.move(0, 0);
  await hideDevTools(page);
  await page.screenshot({ path: path.join(artifacts, "building-hub-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 400, height: 900 });
  await page.screenshot({ path: path.join(artifacts, "building-hub-400.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  const assetsTile = sections.getByRole("link", { name: /^Assets\b/ });
  const assetCount = ((await assetsTile.innerText()).match(/\d+ assets?/) ?? [""])[0];
  expect(assetCount).toMatch(/\d+/);
  await assetsTile.click();
  await expect(page.getByRole("heading", { name: "Assets", exact: true })).toBeVisible();
  await expect(page.getByText(assetCount, { exact: true })).toBeVisible();
  await expectBuildingCurrent(page, true);
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Building", exact: true }).click();
  await expect(page).toHaveURL(/\/building$/);

  for (const href of [
    "/building/inspections",
    "/building/reports",
    "/building/categories",
    "/maintenance",
    "/residents",
    "/contractors",
  ]) {
    await page.goto(href);
    await expectBuildingCurrent(page, true);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Building", exact: true })).toHaveAttribute(
      "href",
      "/building",
    );
  }

  for (const href of ["/dashboard", "/cases", "/work-orders", "/calendar", "/buildings", "/settings"]) {
    await page.goto(href);
    await expectBuildingCurrent(page, false);
  }

  await page.goto("/building/categories");
  await page.mouse.move(0, 0);
  await hideDevTools(page);
  await page.screenshot({ path: path.join(artifacts, "building-categories.png"), fullPage: true });

  await page.goto("/contractors/categories");
  await expect(page).toHaveURL(/\/building\/categories\?tab=contractors$/);
  await expect(page.getByRole("region", { name: "Contractor categories" })).toBeVisible();

  await page.goto("/building/assets/categories");
  await expect(page).toHaveURL(/\/building\/categories\?tab=assets$/);
  await expect(page.getByRole("region", { name: "Asset categories" })).toBeVisible();

  await page.goto("/cases/types");
  await expect(page).toHaveURL(/\/building\/categories\?tab=cases$/);
  await expect(page.getByRole("region", { name: "Case types" })).toBeVisible();
});

test("admin adds, renames, and is blocked from removing an in-use category on each tab", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "admin@tnk.example", "example-admin-pass");

  await editTab(page, {
    tab: "contractors",
    region: "Contractor categories",
    addLabel: "New category",
    addButton: "Add category",
    nameLabel: "Category name",
    added: "Awning",
    renamed: "Awnings",
    inUse: "Plumbing",
    blocked: "message",
  });
  await editTab(page, {
    tab: "assets",
    region: "Asset categories",
    addLabel: "New category",
    addButton: "Add category",
    nameLabel: "Category name",
    added: "Signage",
    renamed: "Wayfinding",
    inUse: "Pumps",
    blocked: "in-use",
  });
  await editTab(page, {
    tab: "cases",
    region: "Case types",
    addLabel: "New case type",
    addButton: "Add case type",
    nameLabel: "Case type name",
    added: "After hours",
    renamed: "Call-out",
    inUse: "Repair & maintenance",
    blocked: "in-use",
  });
});

test("staff sees the building tiles that role can open and can only view categories", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.goto("/building");

  const sections = page.getByRole("region", { name: "Building sections" });
  await expect(sections.getByRole("link")).toHaveCount(TILES.length);
  for (const label of TILES) {
    await expect(sections.getByRole("link", { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  }

  await page.goto("/building/categories?tab=contractors");
  const contractors = page.getByRole("region", { name: "Contractor categories" });
  await expect(contractors.getByText("Plumbing", { exact: true })).toBeVisible();
  await expect(contractors.getByRole("button")).toHaveCount(0);

  await page.goto("/building/categories?tab=assets");
  const assets = page.getByRole("region", { name: "Asset categories" });
  await expect(assets.getByText("Pumps", { exact: true })).toBeVisible();
  await expect(assets.getByRole("button")).toHaveCount(0);

  await page.goto("/building/categories?tab=cases");
  const types = page.getByRole("region", { name: "Case types" });
  await expect(types.getByText("Repair & maintenance", { exact: true })).toBeVisible();
  await expect(types.getByRole("button")).toHaveCount(0);
});

async function editTab(
  page: Page,
  input: {
    tab: string;
    region: string;
    addLabel: string;
    addButton: string;
    nameLabel: string;
    added: string;
    renamed: string;
    inUse: string;
    blocked: "message" | "in-use";
  },
) {
  await page.goto(`/building/categories?tab=${input.tab}`);
  const region = page.getByRole("region", { name: input.region });
  await region.getByLabel(input.addLabel).fill(input.added);
  await region.getByRole("button", { name: input.addButton }).click();
  const added = categoryRow(region, input.added);
  await expect(added).toBeVisible();
  await added.getByLabel(input.nameLabel).fill(input.renamed);
  await added.getByRole("button", { name: "Save" }).click();
  await expect(categoryRow(region, input.renamed)).toBeVisible();
  await expect(categoryRow(region, input.added)).toHaveCount(0);

  const used = categoryRow(region, input.inUse);
  await expect(used.locator(`input[name="name"][value="${input.inUse}"]`)).toBeVisible();
  if (input.blocked === "message") {
    await used.getByRole("button", { name: `Remove ${input.inUse}` }).click();
    await expect(used.getByRole("alert")).toContainText("uses this category");
    await expect(used.locator(`input[name="name"][value="${input.inUse}"]`)).toBeVisible();
  } else {
    await expect(used.getByText("In use", { exact: true })).toBeVisible();
    await expect(used.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  }
}

function categoryRow(region: Locator, name: string): Locator {
  return region.locator(`li:has(input[name="name"][value="${name}"])`);
}

async function hideDevTools(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal{display:none !important}" }).catch(() => undefined);
}

async function expectBuildingCurrent(page: Page, current: boolean) {
  const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Building", exact: true });
  if (current) await expect(link).toHaveAttribute("aria-current", "page");
  else await expect(link).not.toHaveAttribute("aria-current", "page");
}

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
