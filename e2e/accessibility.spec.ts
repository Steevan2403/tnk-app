import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pages = ["/dashboard", "/cases", "/cases/300", "/calendar", "/building"];

test("skip link focuses main and the main screens have no serious accessibility violations", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, "admin@tnk.example", "example-admin-pass");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(serious, formatViolations(path, serious)).toEqual([]);
  }
});

function formatViolations(
  path: string,
  violations: { id: string; impact?: string | null; help: string; nodes: { html: string; target: unknown }[] }[],
): string {
  const lines = violations.map((violation) => {
    const nodes = violation.nodes
      .slice(0, 5)
      .map((node) => `${JSON.stringify(node.target)} ${node.html}`)
      .join("\n");
    return `${violation.impact ?? "unknown"} ${violation.id}: ${violation.help}\n${nodes}`;
  });
  return `${path}\n${lines.join("\n\n")}`;
}

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}
