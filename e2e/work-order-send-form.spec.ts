import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("the send form waits for a contractor, cancels back to the case, and prefills the purchase order", async ({
  page,
}) => {
  await signIn(page);
  await selectExampleTower(page);
  await page.goto("/cases/305/work-order");
  await expect(page.getByRole("heading", { name: "Send work order" })).toBeVisible();

  const contact = page.getByLabel("Contact");
  await expect(contact).toBeDisabled();
  await expect(contact.locator("option:checked")).toHaveText("Choose a contractor first");
  await expect(page.getByRole("button", { name: "Email work order to contractor" })).toBeVisible();

  await page.getByLabel("Contractor").selectOption({ label: "Fictional Fire Services" });
  await expect(contact).toBeEnabled();
  await expect(contact.locator("option:checked")).toHaveText("Choose a contact");

  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.screenshot({ path: path.join(artifacts, "send-work-order-form.png"), fullPage: true });

  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/cases\/305$/);
  await expect(page.getByRole("heading", { level: 1, name: "Example noise complaint for apartment 104" })).toBeVisible();

  await page.goto("/cases/300/work-order");
  await expect(page.getByLabel("Purchase order")).toHaveValue("PO-EX-1001");
});

async function selectExampleTower(page: Page) {
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

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
