import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("sending a work order requires a contact and keeps the rest of the form", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.goto("/cases/308/work-order");
  await expect(page.getByRole("heading", { name: "Send work order" })).toBeVisible();

  await page.getByLabel("Contractor").selectOption({ label: "Sample Plumbing Co" });
  const contact = page.getByLabel("Contact");
  await expect(contact).toHaveValue("");
  await expect(contact.locator("option:checked")).toHaveText("Choose a contact");
  await expect(contact).toHaveAttribute("required", "");
  await page.getByLabel("Subject").fill("Example subject that should stay.");
  await page.getByLabel("Message").fill("Example instructions that should stay.");
  await page.getByLabel("Purchase order").fill("PO-KEEP");
  await page.getByLabel("Access notes").fill("Example: the gate remote is at reception.");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Email work order to contractor" }).click();
  await expect(contact).toHaveJSProperty("validity.valueMissing", true);
  await expect(page).toHaveURL(/\/cases\/308\/work-order$/);
  await expect(page.getByLabel("Subject")).toHaveValue("Example subject that should stay.");
  await expect(page.getByLabel("Access notes")).toHaveValue("Example: the gate remote is at reception.");

  await page.locator("form.form-card").evaluate((form) => {
    const element = form as HTMLFormElement;
    element.noValidate = true;
    element.requestSubmit();
  });
  await expect(page.getByText("Choose a contact of that company with an email.")).toBeVisible();
  await expect(page).toHaveURL(/\/cases\/308\/work-order$/);
  await expect(page.getByLabel("Contractor").locator("option:checked")).toHaveText("Sample Plumbing Co");
  await expect(contact.locator("option:checked")).toHaveText("Choose a contact");
  await expect(page.getByLabel("Subject")).toHaveValue("Example subject that should stay.");
  await expect(page.getByLabel("Message")).toHaveValue("Example instructions that should stay.");
  await expect(page.getByLabel("Purchase order")).toHaveValue("PO-KEEP");
  await expect(page.getByLabel("Access notes")).toHaveValue("Example: the gate remote is at reception.");
  await contact.blur();
  await page.locator("main").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: path.join(artifacts, "work-order-contact-required.png") });

  await page.goto("/settings/outbox");
  await expect(page.getByRole("article", { name: "Example subject that should stay." })).toHaveCount(0);

  await page.goto("/cases/308/work-order");
  await page.getByLabel("Contractor").selectOption({ label: "Sample Plumbing Co" });
  await expect(page.getByLabel("Contact")).toHaveValue("");
  await page.getByLabel("Contact").selectOption({ label: "Casey Placeholder · casey.placeholder@example.com" });
  await page.getByLabel("Subject").fill("Example subject that should stay.");
  await page.getByRole("button", { name: "Email work order to contractor" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Example car park gate fault" })).toBeVisible();
  await expect(page.getByText("Sent work order 308-A to Sample Plumbing Co (Casey Placeholder).")).toBeVisible();

  await page.goto("/settings/outbox");
  const message = page.getByRole("article", { name: "Example subject that should stay." });
  await expect(message.getByText("casey.placeholder@example.com")).toBeVisible();
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

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
