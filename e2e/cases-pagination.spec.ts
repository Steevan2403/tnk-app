import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";

const tower = "seed_example_tower";
const court = "seed_sample_court";
const towerButton = "Example Tower 100 Example Street, Sydney NSW 2000";
const firstNumber = 5000;
const openCount = 55;

test("the case list pages a filtered query", async ({ page }) => {
  const ids = insertCases();
  await signIn(page, "admin@tnk.example", "example-admin-pass");
  try {
    await selectBuilding(page, "Example Tower", towerButton);
    await page.goto("/cases?q=Paged+example&status=new");
    await expect(page.getByText("55 cases")).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(numberLink(page, firstNumber + openCount - 1)).toBeVisible();
    await expect(numberLink(page, firstNumber)).toHaveCount(0);
    await expect(page.getByText("Paged example case for Sample Court")).toHaveCount(0);
    await expect(page.getByText("Example fire pump drip")).toHaveCount(0);

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(numberLink(page, firstNumber)).toBeVisible();
    await expect(numberLink(page, firstNumber + openCount - 1)).toHaveCount(0);

    await page.goto("/cases?q=Paged+example&status=completed");
    await expect(page.getByText("1 case", { exact: true })).toBeVisible();
    await expect(numberLink(page, firstNumber + openCount)).toBeVisible();
    await expect(page.getByRole("link", { name: "Next" })).toHaveCount(0);
  } finally {
    deleteCases(ids);
    await selectBuilding(page, "Example Tower", towerButton);
  }
});

function numberLink(page: Page, number: number) {
  return page.getByRole("link", { name: `#${number}`, exact: true });
}

function insertCases(): string[] {
  const db = new DatabaseSync("prisma/e2e.db");
  const ids: string[] = [];
  try {
    const author = db.prepare("SELECT id FROM User WHERE email = ?").get("admin@tnk.example") as { id: string };
    const now = Date.now();
    const insert = db.prepare(
      `INSERT INTO "Case" (
        id, buildingId, number, typeId, startDate, dueDate, priority, priorityRank, status, statusRank,
        subject, descriptionHtml, includeInReport, area, createdById, createdAt, updatedAt
      ) VALUES (?, ?, ?, 'seed_case_type_repair', ?, ?, 'low', 3, ?, ?, ?, '', 1, 'none', ?, ?, ?)`,
    );
    const start = Date.parse("2026-11-01T00:00:00.000Z");
    const due = Date.parse("2026-11-08T00:00:00.000Z");
    for (let offset = 0; offset < openCount; offset += 1) {
      const number = firstNumber + offset;
      const id = `scope_case_${number}`;
      ids.push(id);
      insert.run(id, tower, number, start, due, "new", 0, `Paged example case ${number}`, author.id, now, now);
    }
    const completedNumber = firstNumber + openCount;
    const completedId = `scope_case_${completedNumber}`;
    ids.push(completedId);
    insert.run(
      completedId,
      tower,
      completedNumber,
      start,
      due,
      "completed",
      5,
      `Paged example case ${completedNumber}`,
      author.id,
      now,
      now,
    );
    const courtId = "scope_case_court";
    ids.push(courtId);
    insert.run(courtId, court, firstNumber, start, due, "new", 0, "Paged example case for Sample Court", author.id, now, now);
  } finally {
    db.close();
  }
  return ids;
}

function deleteCases(ids: string[]) {
  const db = new DatabaseSync("prisma/e2e.db");
  try {
    const statement = db.prepare('DELETE FROM "Case" WHERE id = ?');
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
