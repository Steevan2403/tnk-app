// Named so this file runs before the other end-to-end tests, which add records to the shared database.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

test("admin sees seeded dashboard counts, filters overdue cases, and staff cannot add a number", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await expect(page.getByRole("heading", { name: "Example Tower" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Items needing action" })).toBeVisible();

  const overdueCases = page.getByRole("link", { name: "Overdue cases 3", exact: true });
  await expect(overdueCases).toBeVisible();
  await expect(overdueCases.locator("span").nth(1)).toHaveClass(/text-danger/);
  await expect(page.getByRole("link", { name: "Overdue maintenance 3", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Expired warranties 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Expired insurance 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Failed inspection items 2", exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "15 Residents", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "12 Apartments", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "10 Assets", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "4 Contractors", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "13 Open cases", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "3 Work orders this month", exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "Repair & maintenance 8", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Cases by type, 13/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "11-A", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example pump service", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example car park gate service", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Management reports" }).getByText("1 Oct 2026 to 31 Oct 2026")).toBeVisible();
  await expect(page.getByRole("link", { name: "View PDF for 1 Oct 2026 to 31 Oct 2026" })).toBeVisible();
  await expect(page.getByRole("link", { name: "02 0000 0000" })).toBeVisible();
  await expect(page.getByText("Plant room access")).toBeVisible();
  await expect(page.getByRole("region", { name: "Recent activity" }).getByText("Example Admin").first()).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "dashboard-home-desktop.png");
  await page.getByRole("region", { name: "Items needing action" }).screenshot({
    path: path.join(shots, "dashboard-actions.png"),
  });
  await page.getByRole("region", { name: "Cases by type" }).screenshot({
    path: path.join(shots, "dashboard-donut.png"),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "dashboard-home-mobile.png");

  await page.setViewportSize({ width: 1280, height: 900 });
  await overdueCases.click();
  await expect(page).toHaveURL(/\/cases\?overdue=1/);
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
  await expect(page.getByLabel("Overdue only")).toBeChecked();
  await expect(page.getByText("3 cases", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example fire pump drip" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example noise complaint for apartment 104" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lobby floor (Lobby)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example move in for apartment 101" })).toHaveCount(0);

  await page.goto("/dashboard");
  await page.getByLabel("Title").fill("Example lobby reminder");
  await page.getByLabel("Note", { exact: true }).fill("Example: check the lobby lights after 6pm.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Example: check the lobby lights after 6pm.")).toBeVisible();

  await page.getByRole("textbox", { name: "Label", exact: true }).fill("Example after-hours lift");
  await page.getByRole("textbox", { name: "Number", exact: true }).fill("02 0000 2222");
  await page.getByRole("textbox", { name: "Notes", exact: true }).fill("Example lift call-out.");
  await page.getByRole("button", { name: "Add number" }).click();
  await expect(page.getByRole("link", { name: "02 0000 2222" })).toBeVisible();
  await expect(page.getByText("Example after-hours lift")).toBeVisible();

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await expect(page.getByRole("link", { name: "02 0000 2222" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add number" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add note" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overdue cases 3", exact: true })).toBeVisible();
});

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
}
