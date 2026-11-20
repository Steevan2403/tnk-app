import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";
const apartment = "/residents/apartments/seed_apt_101";
const towerButton = "Example Tower 100 Example Street, Sydney NSW 2000";
const courtButton = "Sample Court 8 Sample Road, Pyrmont NSW 2009";

test("admin adds, edits, and deletes a key; staff can only view; another building is not found", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  try {
    await page.goto(apartment);
    await page.getByRole("link", { name: "Keys", exact: true }).click();
    await expect(page).toHaveURL(/tab=keys/);

    const list = page.getByRole("list", { name: "Keys" });
    await expect(list.getByRole("listitem").nth(0)).toContainText("101-D");
    await expect(list.getByRole("listitem").nth(0)).toContainText("Door");
    await expect(list.getByRole("listitem").nth(1)).toContainText("101-M");
    await expect(list.getByRole("listitem").nth(1)).toContainText("Mailbox");
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(artifacts, "apartment-keys-tab.png"), fullPage: true });

    await page.getByRole("link", { name: "Add key" }).click();
    const dialog = page.getByRole("dialog", { name: "Add key" });
    await expect(dialog).toBeVisible();
    await dialog.screenshot({ path: path.join(artifacts, "apartment-key-add-dialog.png") });

    await dialog.getByLabel("Key number").fill("");
    await dialog.getByLabel("Type").selectOption({ label: "Fob" });
    await dialog.getByLabel("Location").fill("Front desk");
    await dialog.getByLabel("Comment").fill("Spare fob for the lobby.");
    await dialog.getByRole("button", { name: "Add key" }).click();
    await expect(dialog.getByText("Enter a key number.")).toBeVisible();
    await expect(dialog.getByLabel("Type")).toHaveValue("fob");
    await expect(dialog.getByLabel("Location")).toHaveValue("Front desk");
    await expect(dialog.getByLabel("Comment")).toHaveValue("Spare fob for the lobby.");

    await dialog.getByLabel("Key number").fill("101-d");
    await dialog.getByRole("button", { name: "Add key" }).click();
    await expect(dialog.getByText("That key number is already on this apartment.")).toBeVisible();
    await expect(dialog.getByLabel("Key number")).toHaveValue("101-d");
    await expect(dialog.getByLabel("Type")).toHaveValue("fob");
    await expect(dialog.getByLabel("Location")).toHaveValue("Front desk");
    await expect(dialog.getByLabel("Comment")).toHaveValue("Spare fob for the lobby.");

    await dialog.getByLabel("Key number").fill("101-G");
    await dialog.getByLabel("Type").selectOption({ label: "Garage remote" });
    await dialog.getByLabel("Location").fill("Manager office");
    await dialog.getByLabel("Comment").fill("Example garage remote.");
    await dialog.getByRole("button", { name: "Add key" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(list.getByRole("listitem").nth(0)).toContainText("101-D");
    await expect(list.getByRole("listitem").nth(1)).toContainText("101-G");
    await expect(list.getByRole("listitem").nth(1)).toContainText("Garage remote");
    await expect(list.getByRole("listitem").nth(1)).toContainText("Manager office");
    await expect(list.getByRole("listitem").nth(2)).toContainText("101-M");

    await page.getByRole("link", { name: "Edit key 101-G" }).click();
    const edit = page.getByRole("dialog", { name: "Edit key" });
    await expect(edit.getByLabel("Key number")).toHaveValue("101-G");
    await edit.getByLabel("Location").fill("Basement cupboard");
    await edit.getByLabel("Comment").fill("Moved to the basement cupboard.");
    await edit.getByRole("button", { name: "Save key" }).click();
    await expect(edit).toHaveCount(0);
    const updated = list.getByRole("listitem").filter({ hasText: "101-G" });
    await expect(updated).toContainText("Basement cupboard");
    await expect(updated).toContainText("Moved to the basement cupboard.");

    page.once("dialog", async (confirm) => {
      expect(confirm.message()).toBe("Remove key 101-G?");
      await confirm.accept();
    });
    await page.getByRole("button", { name: "Remove key 101-G" }).click();
    await expect(list.getByText("101-G")).toHaveCount(0);
    await expect(list.getByText("101-D")).toBeVisible();
    await expect(list.getByText("101-M")).toBeVisible();

    await selectBuilding(page, "Sample Court", courtButton);
    const response = await page.goto(`${apartment}?tab=keys`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  } finally {
    await page.goto("/dashboard");
    await selectBuilding(page, "Example Tower", towerButton);
  }

  await signOut(page);
  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.goto(`${apartment}?tab=keys`);
  const staffList = page.getByRole("list", { name: "Keys" });
  await expect(staffList.getByText("101-D")).toBeVisible();
  await expect(staffList.getByText("101-M", { exact: true })).toBeVisible();
  await expect(staffList.getByText("Door", { exact: true })).toBeVisible();
  await expect(staffList.getByText("Mailbox", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add key" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Edit key / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove key / })).toHaveCount(0);

  await signOut(page);
  await signIn(page, "manager@tnk.example", "example-manager-pass");
  await page.goto(`${apartment}?tab=keys`);
  await expect(page.getByRole("link", { name: "Add key" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit key 101-D" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove key 101-M" })).toBeVisible();
});

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

async function signOut(page: Page) {
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}
