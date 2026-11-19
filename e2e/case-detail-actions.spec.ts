import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("delete sits in the more actions menu, and status is shown once", async ({ page }) => {
  await signIn(page);
  await page.goto("/cases/new");
  await page.getByLabel("Subject").fill("Example case to remove");
  await page.getByLabel("Case type").selectOption({ label: "Cleaning" });
  await page.getByLabel("Priority").selectOption({ label: "Low" });
  await page.getByLabel("Start date").fill("03/11/2026");
  await page.getByRole("button", { name: "Save case" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example case to remove" })).toBeVisible();

  await expect(page.locator("[data-case-status]")).toHaveCount(1);
  await expect(page.locator("[data-case-status=dropdown]")).toBeVisible();
  await expect(page.locator("[data-case-status=badge]")).toHaveCount(0);
  const info = page.getByRole("heading", { name: "Case information", level: 2 }).locator("xpath=..");
  await expect(info.getByText("Status", { exact: true })).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Delete case" })).toHaveCount(0);
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Delete case" })).toBeVisible();

  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, "case-detail-menu.png") });

  page.once("dialog", (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Delete this case");
    dialog.dismiss();
  });
  await page.getByRole("menuitem", { name: "Delete case" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example case to remove" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await openDelete(page).then((item) => item.click());
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example case to remove" })).toHaveCount(0);
});

function openDelete(page: Page): Promise<Locator> {
  const item = page.getByRole("menuitem", { name: "Delete case" });
  return item.isVisible().then(async (visible) => {
    if (!visible) await page.getByRole("button", { name: "More actions" }).click();
    return item;
  });
}

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
