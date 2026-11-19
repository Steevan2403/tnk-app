import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");
const artifacts = "/opt/cursor/artifacts";

test("apartment and case photos show a lazy thumbnail that opens full size", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  const photoPath = path.join(shots, "example-thumb.png");
  writeFileSync(
    photoPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/residents/apartments/seed_apt_101?tab=images");
  await expect(page.getByRole("button", { name: "Upload images" })).toBeVisible();
  await page.getByLabel("Images").setInputFiles(photoPath);
  await page.getByRole("button", { name: "Upload images" }).click();
  const apartmentThumb = page.getByRole("img", { name: "example-thumb.png" });
  await expect(apartmentThumb).toBeVisible();
  await expect(apartmentThumb).toHaveAttribute("alt", "example-thumb.png");
  await expect(apartmentThumb).toHaveAttribute("loading", "lazy");
  await expect(apartmentThumb).toHaveCSS("object-fit", "cover");
  await shot(page, "thumbnail-apartment.png");
  await expectImage(page, apartmentThumb);

  await page.goto("/cases/300");
  const photos = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Photos" }) })
    .last();
  await photos.locator('input[type="file"]').setInputFiles(photoPath);
  await photos.getByRole("button", { name: "Upload photo" }).click();
  const caseThumb = photos.getByRole("img", { name: "example-thumb.png" });
  await expect(caseThumb).toBeVisible();
  await expect(caseThumb).toHaveAttribute("alt", "example-thumb.png");
  await expect(caseThumb).toHaveAttribute("loading", "lazy");
  await expect(caseThumb).toHaveCSS("object-fit", "cover");
  await shot(page, "thumbnail-case.png");
  await expectImage(page, caseThumb);
});

async function expectImage(page: Page, thumb: ReturnType<Page["getByRole"]>) {
  const src = await thumb.getAttribute("src");
  expect(src).toBeTruthy();
  const full = page.waitForEvent("popup");
  await thumb.click();
  const opened = await full;
  await opened.waitForLoadState("domcontentloaded");
  expect(opened.url()).toContain(src!);
  const response = await page.request.get(src!);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("image/");
  await opened.close();
}

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

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
  await page.screenshot({ path: path.join(artifacts, name), fullPage: true });
}
