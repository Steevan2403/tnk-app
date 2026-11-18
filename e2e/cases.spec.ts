import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAK0lEQVR4nO3OoQEAAAwCIE/f5/MMC4FOkvstAQEBAQEBAQEBAQEBAQGBcaCplfxMSDnSHwAAAABJRU5ErkJggg==",
  "base64",
);

test("admin creates a case for an asset and contractor, updates the board, and staff cannot delete", async ({
  page,
}) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.getByRole("link", { name: "Cases", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Example fire pump drip" })).toBeVisible();

  await page.setViewportSize({ width: 1680, height: 1000 });
  await shot(page, "cases-list-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "cases-list-mobile.png");

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page.getByRole("region", { name: "In progress" })).toBeVisible();
  await expect(page.getByRole("region", { name: "New" }).getByText("Example noise complaint for apartment 104")).toBeVisible();
  await shot(page, "cases-board-desktop.png");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "New case" }).click();
  await expect(page.getByRole("heading", { name: "New case" })).toBeVisible();
  await page.getByLabel("Case type").selectOption({ label: "Repair & maintenance" });
  await page.getByLabel("Priority").selectOption({ label: "High" });
  await page.getByRole("radio", { name: "Asset" }).check();
  await page.getByRole("checkbox", { name: "Fire pump 1" }).check();
  await page.getByRole("checkbox", { name: "Fictional Fire Services" }).check();
  await page.getByRole("checkbox", { name: "Avery Sample" }).check();
  await page.getByLabel("Subject").fill("Example plant room drip");
  await expect(page.getByRole("button", { name: "Bold" })).toBeEnabled();
  await page.locator("#case-description").click();
  await page.keyboard.type("Water under the example fire pump.");
  await shot(page, "cases-form-desktop.png");
  await page.getByRole("button", { name: "Save case" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Example plant room drip" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fire pump 1" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fictional Fire Services" })).toBeVisible();
  await expect(page.getByText("Avery Sample")).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Cases" }).click();
  await page.getByRole("link", { name: "Board", exact: true }).click();
  const card = page.getByRole("article", { name: /Example plant room drip/ });
  const column = page.getByRole("region", { name: "In progress" });
  await card.dragTo(column, { sourcePosition: { x: 24, y: 14 }, targetPosition: { x: 40, y: 80 } });
  await expect(column.getByRole("link", { name: "Example plant room drip" })).toBeVisible();
  await column.getByRole("link", { name: "Example plant room drip" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Example plant room drip" })).toBeVisible();
  await expect(page.getByText("Status changed from New to In progress.")).toBeVisible();

  await page.getByLabel("Comment").fill("Example note from the plant room.");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Example note from the plant room.")).toBeVisible();
  await expect(page.getByText("Added a comment.")).toBeVisible();

  await page.getByLabel("Photo").setInputFiles({ name: "pump.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByRole("img", { name: "pump.png" })).toBeVisible();
  await expect(page.getByText("Added photo pump.png.")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "cases-detail-desktop.png");

  await page.getByRole("link", { name: "Fire pump 1" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fire pump 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Linked cases" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Example plant room drip/ })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "cases-asset-desktop.png");

  const caseUrl = page.getByRole("link", { name: /Example plant room drip/ });
  await caseUrl.click();
  await expect(page).toHaveURL(/\/cases\/\d+$/);
  const detailUrl = page.url();

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.goto(detailUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Example plant room drip" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete case" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove pump.png" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
});

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
}
