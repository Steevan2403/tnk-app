import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("admin manages contractor categories and staff can only view them", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.goto("/building/categories?tab=contractors");
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();

  const categories = page.getByRole("region", { name: "Contractor categories" });
  await expect(categories).toBeVisible();
  await expect(categories.getByLabel("New category")).toBeVisible();

  await categories.getByLabel("New category").fill("   ");
  await categories.getByRole("button", { name: "Add category" }).click();
  await expect(categories.getByText("Enter a category name.")).toBeVisible();

  await categories.getByLabel("New category").fill("plumbing");
  await categories.getByRole("button", { name: "Add category" }).click();
  await expect(categories.getByText("That category already exists.")).toBeVisible();

  await categories.getByLabel("New category").fill("A".repeat(81));
  await categories.getByRole("button", { name: "Add category" }).click();
  await expect(categories.getByText("Use 80 characters or fewer.")).toBeVisible();

  await categories.getByLabel("New category").fill("Glazing");
  await categories.getByRole("button", { name: "Add category" }).click();
  const glazing = categoryRow(categories, "Glazing");
  await expect(glazing).toBeVisible();

  const plumbing = categoryRow(categories, "Plumbing");
  await plumbing.getByRole("button", { name: "Remove Plumbing" }).click();
  await expect(plumbing.getByRole("alert")).toHaveText(
    "1 contractor uses this category. Move that contractor to another category before removing it.",
  );
  await expect(categories.locator('input[name="name"][value="Plumbing"]')).toBeVisible();

  await page.goto("/contractors?tab=companies");
  await expect(page.getByRole("row", { name: /Sample Plumbing Co/ }).getByText("Plumbing", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "New company" }).click();
  await page.getByLabel("Company name").fill("Example Glazier");
  await page.getByLabel("Category").selectOption({ label: "Glazing" });
  await page.getByRole("button", { name: "Save company" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example Glazier" })).toBeVisible();
  await expect(page.getByText("Glazing · Approved")).toBeVisible();
  await page.getByLabel("Contact name").fill("Glen Example");
  await page.getByLabel("Email").fill("glen.example@example.com");
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText("Glen Example")).toBeVisible();

  await page.goto("/building/categories?tab=contractors");
  const glazingRow = categoryRow(page.getByRole("region", { name: "Contractor categories" }), "Glazing");
  const glazingHandle = await glazingRow.elementHandle();
  if (!glazingHandle) throw new Error("Glazing category row was not on the page.");
  const nameInput = await glazingHandle.$("input[name='name']");
  const saveButton = await glazingHandle.$("button[type='submit']");
  if (!nameInput || !saveButton) throw new Error("Glazing category row is missing its name field.");
  await nameInput.fill("Glass");
  await saveButton.click();
  await expect(page.locator('input[name="name"][value="Glass"]')).toBeVisible();
  await page.goto("/contractors");
  await expect(page.getByRole("option", { name: "Glass", exact: true })).toHaveCount(1);
  await expect(page.getByRole("option", { name: "Glazing", exact: true })).toHaveCount(0);

  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Glass" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("row", { name: /Glen Example/ }).getByText("Glass", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Companies", exact: true }).click();
  await expect(page.getByRole("row", { name: /Example Glazier/ }).getByText("Glass", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Plumbing Co" })).toHaveCount(0);

  await openExampleTower(page);
  await page.goto("/cases/305/work-order");
  await expect(page.getByRole("heading", { name: "Send work order" })).toBeVisible();
  await page.getByLabel("Contractor").selectOption({ label: "Example Glazier" });
  await expect(page.getByText("Category: Glass")).toBeVisible();

  await page.goto("/contractors?tab=companies");
  await page.getByRole("link", { name: "Example Glazier" }).click();
  await page.getByRole("link", { name: "Edit", exact: true }).first().click();
  await page.getByLabel("Category").selectOption({ label: "Electrical" });
  await page.getByRole("button", { name: "Save company" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example Glazier" })).toBeVisible();
  await expect(page.getByText("Electrical · Approved")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, "contractor-category-edited.png") });

  await page.goto("/cases/305/work-order");
  await page.getByLabel("Contractor").selectOption({ label: "Example Glazier" });
  await expect(page.getByText("Category: Electrical")).toBeVisible();

  await page.goto("/building/categories?tab=contractors");
  const managed = page.getByRole("region", { name: "Contractor categories" });
  const glass = categoryRow(managed, "Glass");
  await glass.getByRole("button", { name: "Remove Glass" }).click();
  await expect(managed.locator('input[name="name"][value="Glass"]')).toHaveCount(0);

  const electrical = categoryRow(managed, "Electrical");
  await electrical.getByRole("button", { name: "Remove Electrical" }).click();
  await expect(electrical.getByRole("alert")).toContainText("contractors use this category");
  await expect(managed.locator('input[name="name"][value="Electrical"]')).toBeVisible();
  await managed.screenshot({ path: path.join(artifacts, "contractor-categories.png") });

  await page.goto("/contractors?tab=companies");
  await expect(page.getByRole("link", { name: "Example Glazier" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Plumbing Co" })).toBeVisible();

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.goto("/building/categories?tab=contractors");
  const staffCategories = page.getByRole("region", { name: "Contractor categories" });
  await expect(staffCategories.getByText("Plumbing", { exact: true })).toBeVisible();
  await expect(staffCategories.getByText("Electrical", { exact: true })).toBeVisible();
  await expect(staffCategories.getByText("Glass", { exact: true })).toHaveCount(0);
  await expect(staffCategories.getByRole("button", { name: "Add category" })).toHaveCount(0);
  await expect(staffCategories.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await expect(staffCategories.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(staffCategories.getByLabel("New category")).toHaveCount(0);

  await page.goto("/contractors");
  await page.getByRole("link", { name: "Example Glazier" }).click();
  await expect(page.getByText("Electrical · Approved")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  const detail = page.url();
  await page.goto(`${detail}/edit`);
  await expect(page).toHaveURL(detail);
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
});

function categoryRow(region: Locator, name: string): Locator {
  return region.locator(`li:has(input[name="name"][value="${name}"])`);
}

async function openExampleTower(page: Page) {
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
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
