import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const shots = path.join("test-results", "screenshots");

test("admin adds an apartment, resident, vehicle, and document; staff cannot add a resident", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(shots, { recursive: true });
  const files = path.join("test-results", "files");
  mkdirSync(files, { recursive: true });
  const documentPath = path.join(files, "example-lease.txt");
  const imagePath = path.join(files, "example-photo.png");
  writeFileSync(documentPath, "Example lease for apartment 401.\n");
  writeFileSync(imagePath, solidPng(64, 64, [16, 185, 129, 255]));

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await page.getByRole("link", { name: "Residents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Residents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Alex Example" })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, "residents-list-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "residents-list-mobile.png");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("link", { name: "Apartments", exact: true }).click();
  await expect(page.getByRole("link", { name: "Apartments", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: /^104\b/ })).toBeVisible();
  await shot(page, "apartments-list-desktop.png");

  await page.getByRole("link", { name: /^104\b/ }).click();
  await expect(page.getByRole("heading", { name: "104" })).toBeVisible();
  await expect(page.getByText("Example Holdings", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample Strata Management")).toBeVisible();
  await expect(page.getByText("Finley Sample")).toBeVisible();
  await shot(page, "apartment-residents-investment-desktop.png");

  await page.getByRole("link", { name: "All apartments" }).click();
  await page.getByRole("link", { name: /^101\b/ }).click();
  await page.getByRole("link", { name: "Vehicles", exact: true }).click();
  await expect(page.getByText("EXA-001")).toBeVisible();
  await shot(page, "apartment-vehicles-desktop.png");

  await page.getByRole("link", { name: "All apartments" }).click();
  await page.getByRole("button", { name: "New apartment" }).click();
  await page.getByLabel("Apartment number").fill("401");
  await page.getByLabel("Lot number").fill("40");
  await page.getByRole("button", { name: "Save apartment" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "401" })).toBeVisible();
  await page.getByRole("link", { name: "Add resident" }).click();
  await expect(page.getByRole("heading", { name: "New resident" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Apartment" })).not.toHaveValue("");
  await page.getByLabel("First name").fill("Taylor");
  await page.getByLabel("Last name").fill("Example");
  await page.getByLabel("Resident type").selectOption({ label: "Tenant" });
  await page.getByLabel("Mobile").fill("0400 000 999");
  await page.getByLabel("Email").fill("taylor.example@example.com");
  await page.getByLabel("Move-in date").fill("2024-02-01");
  await page.getByRole("checkbox", { name: "Primary contact" }).check();
  await page.getByRole("button", { name: "Save resident" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "401" })).toBeVisible();
  await expect(page.getByText("Taylor Example")).toBeVisible();
  await expect(page.getByText("taylor.example@example.com")).toBeVisible();

  await page.getByRole("link", { name: "Vehicles", exact: true }).click();
  await page.getByLabel("Registration").fill("exa-401");
  await page.getByLabel("Make").fill("Example");
  await page.getByLabel("Model").fill("Hatch");
  await page.getByLabel("Colour").fill("Blue");
  await page.getByLabel("Car space").fill("41");
  await page.getByRole("button", { name: "Add vehicle" }).click();
  await expect(page.getByText("EXA-401")).toBeVisible();

  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page.getByLabel("Document name").fill("Example lease");
  await page.getByLabel("Expiry date").fill("2020-01-15");
  await page.getByLabel("File").setInputFiles(documentPath);
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect(page.getByText("Example lease")).toBeVisible();
  await expect(page.getByText("Expired")).toBeVisible();
  await shot(page, "apartment-documents-desktop.png");

  await page.getByRole("link", { name: "Images", exact: true }).click();
  await page.getByLabel("Images").setInputFiles(imagePath);
  await page.getByRole("button", { name: "Upload images" }).click();
  const photo = page.getByRole("img", { name: "example-photo.png" });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await shot(page, "apartment-images-desktop.png");

  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, "staff@tnk.example", "example-staff-pass");
  await page.getByRole("link", { name: "Residents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Residents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New resident" })).toHaveCount(0);
  await shot(page, "residents-staff-desktop.png");

  await page.goto("/residents/new");
  await expect(page).toHaveURL(/\/residents$/);
  await expect(page.getByRole("link", { name: "New resident" })).toHaveCount(0);
});

async function signIn(page: Page, email: string, password: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, name), fullPage: true });
}

function solidPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 4;
      raw[index] = rgba[0];
      raw[index + 1] = rgba[1];
      raw[index + 2] = rgba[2];
      raw[index + 3] = rgba[3];
    }
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
}

function crc32(data: Buffer): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}
