import { expect, test, type Page } from "@playwright/test";

const towerButton = "Example Tower 100 Example Street, Sydney NSW 2000";
const courtButton = "Sample Court 8 Sample Road, Pyrmont NSW 2009";
const apartment = "/residents/apartments/seed_apt_104";

const notice = Buffer.from("Example notice for apartment 104.\n");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("resident files from another building return 404 and files in the selected building return 200", async ({
  page,
}) => {
  test.setTimeout(120_000);
  let signedIn = false;
  try {
    await signIn(page, "admin@tnk.example", "example-admin-pass");
    signedIn = true;
    await selectBuilding(page, "Example Tower", towerButton);

    const files = await uploadResidentFiles(page);

    await expectFiles(page, files, 200);
    await selectBuilding(page, "Sample Court", courtButton);
    await expectFiles(page, files, 404);
    await selectBuilding(page, "Example Tower", towerButton);
    await expectFiles(page, files, 200);
  } finally {
    if (signedIn) await selectBuilding(page, "Example Tower", towerButton);
  }
});

async function uploadResidentFiles(page: Page) {
  await page.goto(`${apartment}?tab=documents`);
  await expect(page.getByRole("heading", { level: 1, name: "104" })).toBeVisible();
  await page.getByLabel("Document name").fill("Example notice");
  await page.getByLabel("File").setInputFiles({ name: "example-notice.txt", mimeType: "text/plain", buffer: notice });
  await page.getByRole("button", { name: "Upload document" }).click();
  const documentLink = page.getByRole("listitem").filter({ hasText: "Example notice" }).getByRole("link", { name: "Download" });
  await expect(documentLink).toBeVisible();
  const documentHref = await documentLink.getAttribute("href");

  await page.goto(`${apartment}?tab=images`);
  await page.getByLabel("Images").setInputFiles({ name: "example-photo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload images" }).click();
  const imageLink = page.getByRole("link", { name: "example-photo.png" });
  await expect(imageLink).toBeVisible();
  const imageHref = await imageLink.getAttribute("href");

  await page.goto(`${apartment}?tab=vehicles`);
  await page.getByLabel("Registration").fill("EXA-104");
  await page.getByLabel("Photo").setInputFiles({ name: "example-vehicle.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Add vehicle" }).click();
  const vehicleLink = page.getByRole("listitem").filter({ hasText: "EXA-104" }).getByRole("link", { name: "View photo" });
  await expect(vehicleLink).toBeVisible();
  const vehicleHref = await vehicleLink.getAttribute("href");

  return [
    { kind: "documents", href: documentHref, body: notice },
    { kind: "images", href: imageHref, body: png },
    { kind: "vehicles", href: vehicleHref, body: png },
  ];
}

async function expectFiles(
  page: Page,
  files: { kind: string; href: string | null; body: Buffer }[],
  status: 200 | 404,
) {
  for (const file of files) {
    expect(file.href, file.kind).toMatch(new RegExp(`^/api/resident-files/${file.kind}/`));
    const response = await page.request.get(file.href!, { maxRedirects: 0 });
    expect(response.status(), file.kind).toBe(status);
    if (status === 200) {
      expect(Buffer.compare(await response.body(), file.body), file.kind).toBe(0);
    } else {
      expect(await response.text(), file.kind).toBe("Not found");
    }
  }
}

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
