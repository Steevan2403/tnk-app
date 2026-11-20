import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";
const checkInTitle = "Riley Example checked in on site for work order 300-B.";
const checkOutTitle = "Riley Example checked out of work order 300-B.";
const courtTitle = "Example notice for Sample Court.";
const towerTitle = "New case 300: Example fire pump drip.";

test("a check-in notifies the admin, and another building stays hidden", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectBuilding(page, "Example Tower", "Example Tower 100 Example Street, Sydney NSW 2000");

  const bell = page.getByRole("button", { name: /^Notifications,/ });
  await expect(bell).toBeVisible();
  await bell.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("region", { name: "Notifications" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(bell).toBeFocused();

  await bell.click();
  await menu.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByRole("button", { name: "Notifications, no unread" })).toBeVisible();

  await page.goto("/check-in/seed-check-in-300-b-example");
  await expect(page.getByRole("heading", { name: "300-B" })).toBeVisible();
  await page.getByLabel("Your name").fill("Riley Example");
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("as Riley Example")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  const updated = page.getByRole("button", { name: "Notifications, 1 unread" });
  await expect(updated).toBeVisible();
  await updated.click();
  await expect(menu.getByRole("button", { name: unreadName(checkInTitle) })).toBeVisible();
  await expect(menu.getByText(courtTitle)).toHaveCount(0);
  await expect(menu.getByText(towerTitle)).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "notifications-bell-desktop.png") });

  await page.setViewportSize({ width: 400, height: 800 });
  await expect(menu).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "notifications-bell-400.png") });

  await page.setViewportSize({ width: 1280, height: 800 });
  await menu.getByRole("button", { name: unreadName(checkInTitle) }).click();
  await expect(page.getByRole("heading", { name: "Work order 300-B" })).toBeVisible();
  await expect(page.getByText("Riley Example is on site since")).toBeVisible();

  await page.goto("/check-in/seed-check-in-300-b-example");
  await page.getByRole("button", { name: "Check out" }).click();
  await expect(page.getByRole("button", { name: "Check in" })).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await expect(menu.getByRole("button", { name: unreadName(checkInTitle) })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: unreadName(checkOutTitle) })).toBeVisible();
  await menu.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByRole("button", { name: "Notifications, no unread" })).toBeVisible();
  await expect(menu).toBeVisible();
  await expect(menu.getByText(checkOutTitle)).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Unread\./ })).toHaveCount(0);

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.locator("main section").getByText("Example Tower", { exact: true })).toBeVisible();
  await expect(page.getByText(checkInTitle)).toBeVisible();
  await expect(page.getByText(courtTitle)).toHaveCount(0);

  await page.goto("/dashboard");
  await selectBuilding(page, "Sample Court", "Sample Court 8 Sample Road, Pyrmont NSW 2009");
  await page.goto("/notifications");
  await expect(page.getByText(courtTitle)).toBeVisible();
  await expect(page.getByText(checkInTitle)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();

  await selectBuilding(page, "Example Tower", "Example Tower 100 Example Street, Sydney NSW 2000");
  await expect(page.getByRole("button", { name: "Notifications, no unread" })).toBeVisible();
});

function unreadName(title: string): RegExp {
  return new RegExp(`Unread\\.\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

async function selectBuilding(page: Page, name: string, buttonName: string) {
  const switcher = page.getByRole("button", { name: /Switch building/ });
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
