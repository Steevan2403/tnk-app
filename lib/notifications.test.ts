import { describe, expect, it } from "vitest";
import { notificationRecipients, type NotificationPerson } from "./notifications";

const tower = "seed_example_tower";
const court = "seed_sample_court";

const people: NotificationPerson[] = [
  { id: "admin", role: "admin", buildingIds: [] },
  { id: "manager", role: "manager", buildingIds: [tower] },
  { id: "staff", role: "staff", buildingIds: [tower, court] },
  { id: "court-only", role: "staff", buildingIds: [court] },
  { id: "none", role: "manager", buildingIds: [] },
];

describe("notification recipients", () => {
  it("excludes the actor and people who cannot open the building", () => {
    expect(notificationRecipients(people, tower, "admin")).toEqual(["manager", "staff"]);
    expect(notificationRecipients(people, tower, "manager")).toEqual(["admin", "staff"]);
    expect(notificationRecipients(people, court, "staff")).toEqual(["admin", "court-only"]);
  });

  it("includes every member, including an admin with no membership row, when there is no actor", () => {
    expect(notificationRecipients(people, tower, null)).toEqual(["admin", "manager", "staff"]);
    expect(notificationRecipients(people, court, null)).toEqual(["admin", "staff", "court-only"]);
  });
});
