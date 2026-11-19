import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";

const tower = "seed_example_tower";
const court = "seed_sample_court";
const towerButton = "Example Tower 100 Example Street, Sydney NSW 2000";
const courtButton = "Sample Court 8 Sample Road, Pyrmont NSW 2009";
const towerSubject = "Example Tower outbox note";
const courtSubject = "Sample Court outbox note";
const towerId = "scope_mail_tower";
const courtId = "scope_mail_court";

test("the outbox shows mail for the selected building only", async ({ page }) => {
  insertMail(towerId, towerSubject, tower);
  insertMail(courtId, courtSubject, court);
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  try {
    await selectBuilding(page, "Example Tower", towerButton);
    await page.goto("/settings/outbox");
    await expect(page.getByRole("heading", { name: "Outbox", exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: towerSubject })).toBeVisible();
    await expect(page.getByText(courtSubject)).toHaveCount(0);

    await selectBuilding(page, "Sample Court", courtButton);
    await page.goto("/settings/outbox");
    await expect(page.getByRole("article", { name: courtSubject })).toBeVisible();
    await expect(page.getByText(towerSubject)).toHaveCount(0);
  } finally {
    deleteMail(towerId, courtId);
    await selectBuilding(page, "Example Tower", towerButton);
  }
});

function insertMail(id: string, subject: string, buildingId: string) {
  const db = new DatabaseSync("prisma/e2e.db");
  try {
    db.prepare("DELETE FROM OutboxMessage WHERE id = ?").run(id);
    db.prepare(
      "INSERT INTO OutboxMessage (id, toAddress, subject, body, buildingId, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, "ops@example.com", subject, "Example mail for one building.", buildingId, Date.now());
  } finally {
    db.close();
  }
}

function deleteMail(...ids: string[]) {
  const db = new DatabaseSync("prisma/e2e.db");
  try {
    const statement = db.prepare("DELETE FROM OutboxMessage WHERE id = ?");
    for (const id of ids) statement.run(id);
  } finally {
    db.close();
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
