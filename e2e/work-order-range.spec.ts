import { expect, test, type Page } from "@playwright/test";

test("a reversed sent range shows a message and no result list", async ({ page }) => {
  await signIn(page);
  await page.goto("/work-orders");
  await expect(page.getByRole("heading", { name: "Work Orders" })).toBeVisible();

  await page.getByLabel("Sent from").fill("01/12/2026");
  await page.getByLabel("Sent to").fill("01/11/2026");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Sent from is after sent to. Choose a from date on or before the to date.",
  );
  await expect(page.getByText("No work orders match.")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByLabel("Sent from")).toHaveValue("01/12/2026");
  await expect(page.getByLabel("Sent to")).toHaveValue("01/11/2026");
});

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
