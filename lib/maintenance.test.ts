import { describe, expect, it } from "vitest";
import { sydneyDateTimeToUtc } from "./work-orders";
import {
  caseDraftFromOccurrence,
  dueReminders,
  isOccurrenceDate,
  isScheduleComplete,
  maintenanceDeletePrompt,
  maintenanceTab,
  nextDueDate,
  occurrencesBetween,
  overdueDates,
  overdueMaintenance,
  planMaintenanceDelete,
  reminderRecipients,
  removedVisitActivity,
  seriesDeletePrompt,
  seriesDeletedActivity,
  shownVisitStatus,
  type Schedule,
  type StoredOccurrence,
} from "./maintenance";

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function schedule(input: {
  start: string;
  end?: string | null;
  frequency: Schedule["frequency"];
  intervalMonths?: number | null;
}): Schedule {
  return {
    startDate: day(input.start),
    endDate: input.end ? day(input.end) : null,
    frequency: input.frequency,
    intervalMonths: input.intervalMonths ?? null,
  };
}

function isoList(dates: Date[]): string[] {
  return dates.map((date) => date.toISOString().slice(0, 10));
}

function between(input: {
  frequency: Schedule["frequency"];
  intervalMonths?: number | null;
  start: string;
  end: string;
}): string[] {
  const rule = schedule({
    start: input.start,
    end: input.end,
    frequency: input.frequency,
    intervalMonths: input.intervalMonths,
  });
  return isoList(occurrencesBetween(rule, rule.startDate, rule.endDate ?? rule.startDate));
}

function sydneyIso(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

describe("occurrencesBetween", () => {
  it("generates one date for each frequency", () => {
    expect(between({ frequency: "one_off", start: "2026-01-15", end: "2026-03-01" })).toEqual(["2026-01-15"]);
    expect(between({ frequency: "weekly", start: "2026-01-01", end: "2026-01-22" })).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15",
      "2026-01-22",
    ]);
    expect(between({ frequency: "fortnightly", start: "2026-01-01", end: "2026-02-01" })).toEqual([
      "2026-01-01",
      "2026-01-15",
      "2026-01-29",
    ]);
    expect(between({ frequency: "monthly", start: "2026-01-15", end: "2026-04-15" })).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
    expect(between({ frequency: "quarterly", start: "2026-01-15", end: "2026-10-15" })).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
      "2026-10-15",
    ]);
    expect(between({ frequency: "half_yearly", start: "2026-01-15", end: "2027-01-15" })).toEqual([
      "2026-01-15",
      "2026-07-15",
      "2027-01-15",
    ]);
    expect(between({ frequency: "yearly", start: "2026-01-15", end: "2028-01-15" })).toEqual([
      "2026-01-15",
      "2027-01-15",
      "2028-01-15",
    ]);
    expect(between({ frequency: "every_n_months", intervalMonths: 4, start: "2026-01-15", end: "2026-09-15" })).toEqual([
      "2026-01-15",
      "2026-05-15",
      "2026-09-15",
    ]);
  });

  it("clamps month-end dates, including February in leap and non-leap years", () => {
    expect(between({ frequency: "monthly", start: "2024-01-31", end: "2024-05-31" })).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
      "2024-04-30",
      "2024-05-31",
    ]);
    expect(between({ frequency: "monthly", start: "2025-01-31", end: "2025-03-31" })).toEqual([
      "2025-01-31",
      "2025-02-28",
      "2025-03-31",
    ]);
    expect(between({ frequency: "quarterly", start: "2024-01-31", end: "2024-10-31" })).toEqual([
      "2024-01-31",
      "2024-04-30",
      "2024-07-31",
      "2024-10-31",
    ]);
    expect(between({ frequency: "half_yearly", start: "2024-01-31", end: "2025-01-31" })).toEqual([
      "2024-01-31",
      "2024-07-31",
      "2025-01-31",
    ]);
    expect(between({ frequency: "yearly", start: "2024-02-29", end: "2026-02-28" })).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
    ]);
    expect(between({ frequency: "every_n_months", intervalMonths: 4, start: "2026-01-31", end: "2026-09-30" })).toEqual([
      "2026-01-31",
      "2026-05-31",
      "2026-09-30",
    ]);
  });

  it("keeps the same weekday across Sydney daylight-saving changes", () => {
    const autumn = between({ frequency: "weekly", start: "2026-03-30", end: "2026-04-27" });
    expect(autumn).toEqual(["2026-03-30", "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"]);
    expect(between({ frequency: "fortnightly", start: "2026-03-30", end: "2026-04-27" })).toEqual([
      "2026-03-30",
      "2026-04-13",
      "2026-04-27",
    ]);

    // Clocks go back on Sunday 5 April 2026. Adding 7 * 24 hours to a Sydney local time lands a day early.
    const local = sydneyDateTimeToUtc("2026-03-30T00:30");
    expect(local).not.toBeNull();
    const drifted = new Date(local!.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(sydneyIso(drifted)).toBe("2026-04-05");
    expect(autumn[1]).toBe("2026-04-06");

    // Clocks go forward on Sunday 4 October 2026.
    expect(between({ frequency: "weekly", start: "2026-09-27", end: "2026-10-18" })).toEqual([
      "2026-09-27",
      "2026-10-04",
      "2026-10-11",
      "2026-10-18",
    ]);
  });

  it("stops at the end date and stays inside the requested window", () => {
    const rule = schedule({ start: "2026-01-01", end: "2026-01-15", frequency: "weekly" });
    expect(isoList(occurrencesBetween(rule, day("2026-01-08"), day("2026-02-01")))).toEqual(["2026-01-08", "2026-01-15"]);
  });
});

describe("overdue maintenance", () => {
  const today = day("2026-11-18");
  const rule = schedule({ start: "2025-10-18", frequency: "monthly" });
  const records: StoredOccurrence[] = [
    { occursOn: day("2026-10-18"), state: "completed" },
    { occursOn: day("2026-09-18"), state: "skipped" },
  ];

  it("lists visits before today in the last 12 months that are still open", () => {
    expect(isoList(overdueDates(rule, records, today))).toEqual([
      "2025-11-18",
      "2025-12-18",
      "2026-01-18",
      "2026-02-18",
      "2026-03-18",
      "2026-04-18",
      "2026-05-18",
      "2026-06-18",
      "2026-07-18",
      "2026-08-18",
    ]);
  });

  it("returns overdue visits for the dashboard", () => {
    const visits = overdueMaintenance(
      [
        { id: "fire", subject: "Fire system test", schedule: rule, records },
        {
          id: "done",
          subject: "Finished",
          schedule: schedule({ start: "2026-10-01", end: "2026-10-01", frequency: "one_off" }),
          records: [{ occursOn: day("2026-10-01"), state: "completed" }],
        },
      ],
      today,
    );
    expect(visits.map((visit) => visit.eventId)).toEqual(Array(10).fill("fire"));
    expect(visits[0]).toMatchObject({ eventId: "fire", subject: "Fire system test" });
    expect(nextDueDate(rule, records, today)?.toISOString().slice(0, 10)).toBe("2026-11-18");
  });
});

describe("schedule completion", () => {
  const today = day("2026-11-18");

  it("completes a one-off once its visit is recorded and the date has passed", () => {
    const rule = schedule({ start: "2026-10-01", frequency: "one_off" });
    const done: StoredOccurrence[] = [{ occursOn: day("2026-10-01"), state: "completed" }];
    expect(isScheduleComplete(rule, done, today)).toBe(true);
    expect(maintenanceTab(rule, done, today)).toBe("completed");
    expect(maintenanceTab(rule, [], today)).toBe("overdue");
  });

  it("keeps an open-ended schedule active when every past visit is done", () => {
    const rule = schedule({ start: "2026-09-01", frequency: "monthly" });
    const records: StoredOccurrence[] = [
      { occursOn: day("2026-09-01"), state: "completed" },
      { occursOn: day("2026-10-01"), state: "skipped" },
      { occursOn: day("2026-11-01"), state: "completed" },
    ];
    expect(maintenanceTab(rule, records, today)).toBe("active");
  });

  it("completes a schedule only after the end date, when every visit is done", () => {
    const rule = schedule({ start: "2026-09-01", end: "2026-10-01", frequency: "monthly" });
    const records: StoredOccurrence[] = [
      { occursOn: day("2026-09-01"), state: "completed" },
      { occursOn: day("2026-10-01"), state: "skipped" },
    ];
    expect(maintenanceTab(rule, records, today)).toBe("completed");
    const stillRunning = schedule({ start: "2026-09-01", end: "2026-12-01", frequency: "monthly" });
    expect(
      maintenanceTab(stillRunning, [...records, { occursOn: day("2026-11-01"), state: "completed" }], today),
    ).toBe("active");
  });
});

describe("dueReminders", () => {
  const today = day("2026-11-18");
  const rule = schedule({ start: "2026-11-25", frequency: "monthly" });
  const event = {
    id: "fire",
    subject: "Fire system test",
    buildingName: "Example Tower",
    description: "Example monthly test.",
    reminderDays: 7,
    remindContractor: true,
    schedule: rule,
    records: [] as StoredOccurrence[],
    emails: ["Avery.Sample@example.com", "avery.sample@example.com"],
  };

  it("queues one reminder per occurrence and never a second one", () => {
    const first = dueReminders([event], [], today);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      eventId: "fire",
      occursOn: "2026-11-25",
      to: ["avery.sample@example.com"],
      subject: "Maintenance reminder: Fire system test",
    });
    expect(first[0].body).toContain("Example Tower");
    expect(dueReminders([event], [{ eventId: "fire", occursOn: "2026-11-25" }], today)).toEqual([]);
    expect(dueReminders([event], first.map((item) => ({ eventId: item.eventId, occursOn: item.occursOn })), today)).toEqual([]);
  });

  it("skips completed visits, reminders that are not due, and events with nobody to email", () => {
    expect(
      dueReminders([{ ...event, records: [{ occursOn: day("2026-11-25"), state: "completed" }] }], [], today),
    ).toEqual([]);
    expect(dueReminders([{ ...event, reminderDays: 6 }], [], today)).toEqual([]);
    expect(dueReminders([{ ...event, remindContractor: false }], [], today)).toEqual([]);
    expect(dueReminders([{ ...event, emails: [] }], [], today)).toEqual([]);
    expect(reminderRecipients(["pat.example@example.com"], ["office@example.com"])).toEqual(["pat.example@example.com"]);
    expect(reminderRecipients([null], ["Office@example.com"])).toEqual(["office@example.com"]);
  });
});

describe("removed visits", () => {
  const today = day("2026-11-18");
  const rule = schedule({ start: "2025-10-18", frequency: "monthly" });

  it("leaves a removed visit off the overdue list and off the calendar", () => {
    const records: StoredOccurrence[] = [
      { occursOn: day("2026-10-18"), state: "completed" },
      { occursOn: day("2026-08-18"), state: "removed" },
    ];
    expect(isoList(overdueDates(rule, records, today))).not.toContain("2026-08-18");
    expect(nextDueDate(rule, records, today)?.toISOString().slice(0, 10)).toBe("2026-11-18");
    expect(shownVisitStatus(day("2026-08-18"), "removed", today)).toBeNull();
    expect(shownVisitStatus(day("2026-08-18"), null, today)).toBe("overdue");
  });

  it("does not remind anyone about a removed visit", () => {
    const event = {
      id: "fire",
      subject: "Fire system test",
      buildingName: "Example Tower",
      description: "Example monthly test.",
      reminderDays: 7,
      remindContractor: true,
      schedule: schedule({ start: "2026-11-25", frequency: "monthly" }),
      records: [{ occursOn: day("2026-11-25"), state: "removed" as const }],
      emails: ["avery.sample@example.com"],
    };
    expect(dueReminders([event], [], today)).toEqual([]);
  });

  it("treats a removed visit as nothing left to do once the series has ended", () => {
    const ended = schedule({ start: "2026-09-01", end: "2026-10-01", frequency: "monthly" });
    const records: StoredOccurrence[] = [
      { occursOn: day("2026-09-01"), state: "completed" },
      { occursOn: day("2026-10-01"), state: "removed" },
    ];
    expect(isScheduleComplete(ended, records, today)).toBe(true);
    expect(maintenanceTab(ended, records, today)).toBe("completed");
  });
});

describe("maintenance delete", () => {
  it("lets an admin or a manager delete, and blocks staff", () => {
    expect(planMaintenanceDelete({ role: "admin", frequency: "monthly", scope: "occurrence" })).toEqual({
      ok: true,
      action: "occurrence",
    });
    expect(planMaintenanceDelete({ role: "manager", frequency: "monthly", scope: "series" })).toEqual({
      ok: true,
      action: "series",
    });
    expect(planMaintenanceDelete({ role: "staff", frequency: "monthly", scope: "series" })).toEqual({
      ok: false,
      error: "You do not have permission to delete maintenance.",
    });
  });

  it("deletes one visit of a repeating event, and the whole event when it is one-off", () => {
    expect(planMaintenanceDelete({ role: "admin", frequency: "weekly", scope: "occurrence" })).toEqual({
      ok: true,
      action: "occurrence",
    });
    expect(planMaintenanceDelete({ role: "admin", frequency: "one_off", scope: "occurrence" })).toEqual({
      ok: true,
      action: "series",
    });
    expect(planMaintenanceDelete({ role: "admin", frequency: "monthly", scope: "nope" })).toEqual({
      ok: false,
      error: "Choose this visit or the whole series.",
    });
  });

  it("says what a visit delete and a series delete will change", () => {
    expect(
      maintenanceDeletePrompt({
        subject: "Example fire system test",
        dateLabel: "18 Nov 2026",
        recurring: true,
        visitCases: 1,
        seriesCases: 2,
        fileCount: 1,
      }).message,
    ).toBe(
      [
        "This visit is 18 Nov 2026. Choose this visit only, or the whole series.",
        "This visit only: that date comes off the calendar. The other visits stay. 1 case already opened from this visit stays, including its work orders.",
        "Whole series: the schedule, visit history, and reminders are removed. 1 file is removed. 2 cases already opened from this series stay, including their work orders.",
      ].join("\n"),
    );
    expect(
      maintenanceDeletePrompt({
        subject: "Example lobby camera check",
        dateLabel: "12 Jul 2026",
        recurring: false,
        visitCases: 0,
        seriesCases: 0,
        fileCount: 0,
      }).message,
    ).toBe(
      "Delete this event on 12 Jul 2026?\nThe event, its visit history, and its reminders are removed. It has no files. No cases were opened from it.",
    );
    expect(
      seriesDeletePrompt({ subject: "Example gutter clean", recurring: true, seriesCases: 0, fileCount: 0 }).message,
    ).toContain("Delete every visit in this series?");
    expect(removedVisitActivity("Example fire system test", "18 Nov 2026")).toBe(
      "Deleted the 18 Nov 2026 visit of Example fire system test. Other visits were kept.",
    );
    expect(seriesDeletedActivity("Example fire system test", 2)).toBe(
      "Deleted maintenance event Example fire system test. 2 cases already opened from it were kept, including their work orders.",
    );
    expect(seriesDeletedActivity("Example lobby camera check", 0)).toBe(
      "Deleted maintenance event Example lobby camera check. No cases had been opened from it.",
    );
  });
});

describe("caseDraftFromOccurrence", () => {
  const rule = schedule({ start: "2026-01-18", frequency: "monthly" });

  it("pre-fills a repair case from the occurrence and ignores other dates", () => {
    const draft = caseDraftFromOccurrence(
      {
        subject: "Fire system test",
        description: "Check the example panel.",
        notes: "Example note",
        area: "asset",
        assetIds: ["panel"],
        apartmentId: null,
        companyIds: ["fire"],
        contactIds: ["avery"],
      },
      "2026-10-18",
      "repair",
    );
    expect(draft).toMatchObject({
      typeId: "repair",
      subject: "Fire system test",
      startDate: "2026-10-18",
      dueDate: "2026-10-18",
      area: "asset",
      assetIds: ["panel"],
      companyIds: ["fire"],
      contactIds: ["avery"],
      internalNotes: "Example note",
    });
    expect(draft.descriptionHtml).toContain("Check the example panel.");
    expect(isOccurrenceDate(rule, day("2026-10-18"))).toBe(true);
    expect(isOccurrenceDate(rule, day("2026-10-19"))).toBe(false);
  });
});
