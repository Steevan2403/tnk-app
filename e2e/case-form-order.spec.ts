import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("the new case form leads with subject and type, and priority must be chosen", async ({ page }) => {
  await signIn(page);
  await page.goto("/cases/new");
  await expect(page.getByRole("heading", { name: "New case" })).toBeVisible();

  const formText = await page.locator("form.form-card").innerText();
  const subjectAt = formText.indexOf("Subject");
  const typeAt = formText.indexOf("Case type");
  const descriptionAt = formText.indexOf("Description");
  const purchaseAt = formText.indexOf("Purchase order");
  expect(subjectAt).toBeGreaterThanOrEqual(0);
  expect(subjectAt).toBeLessThan(typeAt);
  expect(typeAt).toBeLessThan(descriptionAt);
  expect(descriptionAt).toBeLessThan(purchaseAt);

  await expect(page.locator("label[for=subject]")).toContainText("*");
  await expect(page.locator("label[for=typeId]")).toContainText("*");
  await expect(page.locator("label[for=priority]")).toContainText("*");
  await expect(page.getByLabel("Subject")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Case type")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Priority")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Priority")).toHaveValue("");
  await expect(page.getByLabel("Due date")).not.toHaveAttribute("aria-required", "true");

  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.screenshot({ path: path.join(artifacts, "new-case-form.png"), fullPage: true });

  await page.getByLabel("Subject").fill("Example priority left blank");
  await page.getByLabel("Case type").selectOption({ label: "Cleaning" });
  const typeValue = await page.getByLabel("Case type").inputValue();
  await page.getByLabel("Start date").fill("02/11/2026");
  await page.locator("#case-description").click();
  await page.keyboard.type("Example description that should stay.");

  await page.locator("form.form-card").evaluate((form) => {
    const element = form as HTMLFormElement;
    element.noValidate = true;
    element.requestSubmit();
  });

  await expect(page.getByText("Choose a priority.")).toBeVisible();
  await expect(page.getByLabel("Subject")).toHaveValue("Example priority left blank");
  await expect(page.getByLabel("Case type")).toHaveValue(typeValue);
  await expect(page.getByLabel("Start date")).toHaveValue("02/11/2026");
  await expect(page.getByLabel("Priority")).toHaveValue("");
  await expect(page.locator("#case-description")).toContainText("Example description that should stay.");
});

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
