import { expect, test, type Page } from "@playwright/test";

test("a blank due date is saved seven days after the start, and job areas use the new labels", async ({ page }) => {
  await signIn(page);
  await page.goto("/cases/new");

  await expect(page.getByRole("radio", { name: "Common asset" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Private lot" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "N/A" })).toBeChecked();
  await expect(page.getByLabel("Due date")).toHaveValue("");
  await expect(page.getByText("Leave this blank and the due date is set to 7 days after the start date.")).toBeVisible();

  await page.getByLabel("Case type").selectOption({ label: "Cleaning" });
  await page.getByLabel("Priority").selectOption({ label: "Low" });
  await page.getByLabel("Start date").fill("02/11/2026");
  await page.getByLabel("Subject").fill("Example blank due date");
  await page.getByRole("button", { name: "Save case" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Example blank due date" })).toBeVisible();
  const info = page.locator("section").filter({ has: page.getByRole("heading", { name: "Case information" }) });
  await expect(info.getByText("2 Nov 2026")).toBeVisible();
  await expect(info.getByText("9 Nov 2026")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Job area" }).locator("xpath=..")).toContainText("N/A");
});

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@tnk.example");
  await page.getByLabel("Password").fill("example-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
