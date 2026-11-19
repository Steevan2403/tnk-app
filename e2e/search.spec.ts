import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

test("search finds building records, follows the keyboard, and stays inside role and building", async ({ page, request }) => {
  test.setTimeout(180_000);
  mkdirSync(shots, { recursive: true });

  const denied = await request.get("/api/search?q=300");
  expect(denied.status()).toBe(401);

  try {
    await signIn(page, "admin@tnk.example", "example-admin-pass");
    await useBuilding(page, "Example Tower");

    const search = page.getByRole("combobox", { name: "Search" });
    await search.fill("300");
    const list = page.getByRole("listbox", { name: "Search results" });
    await expect(list.getByRole("option", { name: /300 · Example fire pump drip/ })).toBeVisible();
    await expect(list.getByRole("option", { name: /300-A/ })).toBeVisible();
    await expect(list.getByRole("option", { name: /300-B/ })).toBeVisible();

    await search.fill("Please inspect");
    await expect(list.getByRole("option", { name: /Example fire pump drip/ })).toBeVisible();
    await expect(list.getByRole("group")).toHaveCount(1);
    await expect(list.getByRole("group", { name: "Cases" })).toBeVisible();

    await search.fill("alex.example@example.com");
    const resident = list.getByRole("option", { name: /Alex Example/ });
    await expect(resident).toBeVisible();
    await search.press("ArrowDown");
    await expect(resident).toHaveAttribute("aria-selected", "true");
    await search.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "101" })).toBeVisible();
    await expect(page).toHaveURL(/\/residents\/apartments\//);

    await page.goto("/dashboard");
    await search.fill("0400 000 001");
    await expect(list.getByRole("option", { name: /Alex Example/ })).toBeVisible();

    await search.fill("304");
    await expect(list.getByRole("option", { name: /Apartment 304/ })).toBeVisible();
    await expect(list.getByRole("option", { name: /304 · Example common area clean/ })).toBeVisible();

    await search.fill("Sample Plumbing");
    await expect(list.getByRole("group", { name: "Work orders" }).getByRole("option", { name: /307-A/ })).toBeVisible();
    await expect(list.getByRole("group", { name: "Contractors" }).getByRole("option", { name: /Sample Plumbing Co/ })).toBeVisible();

    await search.fill("CCTV");
    await expect(list.getByRole("option", { name: /Lobby camera 1/ })).toBeVisible();

    await search.fill("Lot exit");
    const inspections = list.getByRole("group", { name: "Inspections" });
    await expect(inspections.getByRole("option", { name: /Template/ })).toBeVisible();
    await expect(inspections.getByRole("option", { name: /Completed · Apartment 104/ })).toBeVisible();

    await search.fill("Example roof inspection");
    const template = list.getByRole("option", { name: /Example roof inspection/ });
    await expect(template).toBeVisible();
    await expect(template).toHaveAttribute("href", /\/building\/inspections\/templates\//);

    await search.press("Escape");
    await expect(list).toBeHidden();

    await search.fill("zzzz-not-a-record");
    await expect(page.getByRole("status")).toHaveText("No matches for “zzzz-not-a-record”.");
    await expect(list).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await search.fill("fire");
    await expect(list.getByRole("group", { name: "Cases" })).toBeVisible();
    await expect(list.getByRole("group", { name: "Work orders" })).toBeVisible();
    await expect(list.getByRole("group", { name: "Contractors" })).toBeVisible();
    await expect(list.getByRole("group", { name: "Assets" })).toBeVisible();
    await expect(list.getByRole("option", { name: "See all results" })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(shots, "search-dropdown-desktop.png") });

    await list.getByRole("option", { name: "See all results" }).click();
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
    await expect(page.getByText("Results for “fire” in Example Tower.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Work orders" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contractors" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
    const asset = page.getByRole("link", { name: /Fire pump 1/ });
    await expect(asset).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(shots, "search-results-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(shots, "search-results-mobile.png"), fullPage: true });
    await search.fill("fire");
    await expect(list.getByRole("option", { name: /Fire pump 1/ })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(shots, "search-dropdown-mobile.png") });

    await page.setViewportSize({ width: 1280, height: 800 });
    await search.press("Escape");
    await asset.click();
    await expect(page.getByRole("heading", { level: 1, name: "Fire pump 1" })).toBeVisible();

    await page.goto("/dashboard");
    await useBuilding(page, "Sample Court");
    await search.fill("Fire pump 1");
    await expect(page.getByRole("status")).toHaveText("No matches for “Fire pump 1”.");
    await search.fill("Sample Plumbing");
    await expect(list.getByRole("group", { name: "Contractors" }).getByRole("option", { name: /Sample Plumbing Co/ })).toBeVisible();
    await expect(list.getByRole("group", { name: "Cases" })).toHaveCount(0);
    await expect(list.getByRole("group", { name: "Work orders" })).toHaveCount(0);
    await useBuilding(page, "Example Tower");

    await page.locator("header summary").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await signIn(page, "staff@tnk.example", "example-staff-pass");
    await useBuilding(page, "Example Tower");
    await search.fill("300");
    await expect(list.getByRole("option", { name: /300 · Example fire pump drip/ })).toBeVisible();
    await expect(list.getByRole("option", { name: /300-A/ })).toBeVisible();
    await search.fill("Example roof inspection");
    await expect(page.getByRole("status")).toHaveText("No matches for “Example roof inspection”.");
    await search.fill("Lot exit");
    const run = list.getByRole("option", { name: /Lot exit inspection/ });
    await expect(run).toBeVisible();
    await expect(run).toHaveAttribute("href", /\/building\/inspections\/runs\//);
    await run.click();
    await expect(page.getByRole("heading", { level: 1, name: "Lot exit inspection" })).toBeVisible();

    await page.goto("/dashboard");
    await useBuilding(page, "Sample Court");
    await search.fill("Lobby camera 1");
    await expect(page.getByRole("status")).toHaveText("No matches for “Lobby camera 1”.");
    await useBuilding(page, "Example Tower");
  } finally {
    if (await page.getByRole("button", { name: /Switch building/ }).isVisible().catch(() => false)) {
      await useBuilding(page, "Example Tower");
    }
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("combobox", { name: "Search" })).toBeVisible();
}

async function useBuilding(page: Page, name: string) {
  const current = page.getByRole("button", { name: /Switch building/ });
  await expect(current).toBeVisible();
  if ((await current.innerText()).includes(name)) return;
  await current.click();
  await page.locator("aside").getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(current).toContainText(name);
}
