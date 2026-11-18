import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

test("admin records a company with expired insurance and staff cannot add one", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.getByRole("link", { name: "Contractors" }).click();
  await expect(page.getByRole("heading", { name: "Contractors" })).toBeVisible();

  const tabs = [
    ["Contacts", "contractors-contacts"],
    ["Companies", "contractors-companies"],
    ["Expired insurance", "contractors-expired"],
    ["Pending approval", "contractors-pending"],
  ] as const;

  for (const [label, file] of tabs) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    await shot(page, `${file}-desktop.png`);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, `${file}-mobile.png`);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("link", { name: "Expired insurance", exact: true }).click();
  await page.getByRole("link", { name: "Sample Plumbing Co" }).click();
  await expect(page.getByRole("heading", { name: "Sample Plumbing Co" })).toBeVisible();
  await expect(page.getByText("1 May 2024")).toBeVisible();
  await shot(page, "contractors-detail-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "contractors-detail-mobile.png");

  await page.setViewportSize({ width: 1280, height: 800 });
  const companyName = `Example Test Electric ${Date.now()}`;
  await page.getByRole("link", { name: "All contractors" }).click();
  await page.getByRole("link", { name: "New company" }).click();
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("ABN").fill("12345678901");
  await page.getByLabel("Address").fill("1 Test Street, Sydney NSW 2000");
  await page.getByLabel("Phone").fill("02 0000 1111");
  await page.getByLabel("Company email").fill("office.test@example.com");
  await page.getByLabel("Website").fill("https://example.com/test-electric");
  await page.getByLabel("Category").selectOption({ label: "Electrical" });
  await page.getByRole("button", { name: "Save company" }).click();

  await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();
  await page.getByLabel("Contact name").fill("Taylor Example");
  await page.getByLabel("Role").fill("Tester");
  await page.getByLabel("Mobile").fill("0400 000 999");
  await page.getByLabel("Email").fill("taylor.example@example.com");
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText("Taylor Example")).toBeVisible();

  await page.getByLabel("Insurance type").fill("Public liability");
  await page.getByLabel("Policy number").fill("PL-TEST-1");
  await page.getByLabel("Insurer").fill("Example Cover");
  await page.getByLabel("Expiry date").fill("2020-01-15");
  await page.getByRole("button", { name: "Add insurance" }).click();
  await expect(page.getByText("15 Jan 2020")).toBeVisible();
  await expect(page.getByText("Expired").first()).toBeVisible();

  await page.goto("/contractors?tab=expired");
  await expect(page.getByRole("link", { name: companyName })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Plumbing Co" })).toBeVisible();

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.getByRole("link", { name: "Contractors" }).click();
  await expect(page.getByRole("heading", { name: "Contractors" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New company" })).toHaveCount(0);
  await shot(page, "contractors-staff-desktop.png");

  await page.goto("/contractors/new");
  await expect(page).toHaveURL(/\/contractors$/);
  await expect(page.getByRole("link", { name: "New company" })).toHaveCount(0);

  await page.getByRole("link", { name: "Sample Plumbing Co" }).click();
  await expect(page.getByRole("heading", { name: "Sample Plumbing Co" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add contact" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete company" })).toHaveCount(0);
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
