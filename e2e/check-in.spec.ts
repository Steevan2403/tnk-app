import { mkdirSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";

test("unknown and closed check-in links are not found", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unknown = await page.goto("/check-in/not-a-real-token-value");
  expect(unknown?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Check-in link" })).toBeVisible();
  await expect(
    page.getByText(
      "This check-in link is not valid. It can be used for more than one visit until the work order is completed or cancelled.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Check in" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

  const missing = await page.goto("/check-in/preview");
  expect(missing?.status()).toBe(404);

  const completed = await page.goto("/check-in/seed-check-in-310-a-example");
  expect(completed?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "310-A" })).toHaveCount(0);
  await expect(page.getByText("completed or cancelled")).toBeVisible();

  const cancelled = await page.goto("/check-in/seed-check-in-313-a-example");
  expect(cancelled?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "313-A" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check out" })).toHaveCount(0);

  const open = await page.goto("/check-in/seed-check-in-300-a-example");
  expect(open?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "300-A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check in" })).toBeVisible();
});

test("contractor checks in and out, and staff see the visit history", async ({ page, browser }) => {
  test.setTimeout(120_000);
  mkdirSync(artifacts, { recursive: true });

  await signIn(page, "admin@tnk.example", "example-admin-pass");
  await selectExampleTower(page);
  await page.goto("/cases/302");
  await page.getByRole("link", { name: "Send work order" }).first().click();
  await page.getByLabel("Contractor").selectOption({ label: "Fictional Fire Services" });
  await page.getByLabel("Contact").selectOption({ label: "Avery Sample · avery.sample@example.com" });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example move in for apartment 101" })).toBeVisible();

  await page.goto("/work-orders");
  const pdfHref = await page.getByRole("link", { name: "View PDF for 302-A" }).getAttribute("href");
  const pdfResponse = await page.request.get(pdfHref!);
  expect(pdfResponse.ok()).toBeTruthy();
  const pdf = await pdfResponse.body();
  const pdfText = `${pdf.toString("latin1")}\n${inflatePdf(pdf)}`;
  expect(pdfText).toContain("/check-in/");
  expect(pdfText.includes("checkin=1")).toBe(false);

  await page.goto("/settings/outbox");
  const message = page.getByRole("article", { name: /Work order 302-A/ });
  await expect(message).toBeVisible();
  const checkInUrl = (await message.innerText()).match(/https?:\/\/\S+\/check-in\/[A-Za-z0-9_-]+/)?.[0];
  expect(checkInUrl).toBeTruthy();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const contractor = await phone.newPage();
  const other = await phone.newPage();
  await contractor.goto(checkInUrl!);
  await other.goto(checkInUrl!);
  await expect(contractor.getByRole("heading", { name: "302-A" })).toBeVisible();
  await expect(contractor.getByText("Example Tower")).toBeVisible();
  await expect(contractor.getByText("100 Example Street, Sydney NSW 2000")).toBeVisible();
  await expect(contractor.getByText("Example move in for apartment 101")).toBeVisible();
  await expect(contractor.getByLabel("Your name")).toHaveValue("Avery Sample");
  await expect(contractor.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await shot(contractor, "check-in-before.png");

  await contractor.getByLabel("Your name").fill("Riley Example");
  await contractor.getByRole("button", { name: "Check in" }).click();
  await expect(contractor.getByText("Checked in", { exact: false })).toBeVisible();
  await expect(contractor.getByText("as Riley Example")).toBeVisible();
  await expect(contractor.getByRole("button", { name: "Check out" })).toBeVisible();
  await shot(contractor, "check-in-after.png");

  await other.getByRole("button", { name: "Check in" }).click();
  await expect(other.getByText("You are already checked in. Check out when you leave.")).toBeVisible();

  await contractor.getByRole("button", { name: "Check out" }).click();
  await expect(contractor.getByRole("button", { name: "Check in" })).toBeVisible();
  await expect(contractor.getByLabel("Your name")).toHaveValue("Avery Sample");

  await phone.grantPermissions(["geolocation"]);
  await phone.setGeolocation({ latitude: -33.8688, longitude: 151.2093 });
  await contractor.getByLabel("Your name").fill("Riley Example");
  await contractor.getByRole("button", { name: "Check in" }).click();
  await expect(contractor.getByRole("button", { name: "Check out" })).toBeVisible();

  await page.goto("/work-orders");
  await page.getByRole("link", { name: "302-A", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Work order 302-A" })).toBeVisible();
  await expect(page.getByText("Riley Example is on site since")).toBeVisible();
  await expect(page.getByRole("heading", { name: "On-site history" })).toBeVisible();
  await expect(page.getByText("Time on site: Under 1 minute")).toBeVisible();
  await expect(page.getByText("Check-in location -33.86880, 151.20930")).toBeVisible();
  await expect(page.getByText("Still on site")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "work-order-check-in-history.png");

  await page.goto("/cases/302");
  await expect(page.getByText("Checked in to work order 302-A.")).toHaveCount(2);
  await expect(page.getByText("Checked out of work order 302-A after Under 1 minute.")).toBeVisible();
  await expect(page.getByText("On site · Riley Example")).toBeVisible();

  await phone.close();
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

async function shot(page: Page, name: string) {
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.screenshot({ path: path.join(artifacts, name), fullPage: true });
}

function inflatePdf(bytes: Buffer): string {
  const source = bytes.toString("latin1");
  const parts: string[] = [];
  const marker = /(?<!d)stream\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(source))) {
    const start = match.index + match[0].length;
    const end = source.indexOf("\nendstream", start);
    if (end < 0) continue;
    try {
      parts.push(inflateSync(Buffer.from(source.slice(start, end), "latin1")).toString("latin1"));
    } catch {
      // Skip streams that are not flate-compressed page content.
    }
  }
  return parts.join("\n");
}
