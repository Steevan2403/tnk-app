import { describe, expect, it } from "vitest";
import {
  INVALID_CHECK_IN_LINK,
  decideSiteAction,
  formatDuration,
  formatLocation,
  isCheckInToken,
  newCheckInToken,
  optionalLocation,
  prefilledContractorName,
  siteVisitActivity,
  workOrderClosedMessage,
} from "./check-in";

describe("check-in token", () => {
  it("creates an unguessable token and rejects a short placeholder", () => {
    const token = newCheckInToken();
    expect(isCheckInToken(token)).toBe(true);
    expect(token).not.toBe(newCheckInToken());
    expect(isCheckInToken("preview")).toBe(false);
    expect(isCheckInToken("seed-check-in-300-a-example")).toBe(true);
  });

  it("says a link stays reusable until the work order is completed or cancelled", () => {
    expect(INVALID_CHECK_IN_LINK.toLowerCase()).not.toContain("expired");
    expect(INVALID_CHECK_IN_LINK).toContain("more than one visit");
    expect(INVALID_CHECK_IN_LINK).toContain("completed or cancelled");
  });
});

describe("contractor name", () => {
  it("prefills the assigned contact, then the company", () => {
    expect(prefilledContractorName("Avery Sample", "Fictional Fire Services")).toBe("Avery Sample");
    expect(prefilledContractorName("  ", "Fictional Fire Services")).toBe("Fictional Fire Services");
    expect(prefilledContractorName(null, "  ")).toBe("");
  });
});

describe("on-site decisions", () => {
  it("checks in with a name when the work order is open", () => {
    expect(decideSiteAction({ status: "new", action: "check_in", hasOpenVisit: false, name: " Riley Example " })).toEqual({
      ok: true,
      name: "Riley Example",
    });
  });

  it("rejects a second check-in and a check-out with nobody on site", () => {
    expect(decideSiteAction({ status: "in_progress", action: "check_in", hasOpenVisit: true, name: "Riley Example" })).toEqual({
      ok: false,
      error: "You are already checked in. Check out when you leave.",
    });
    expect(decideSiteAction({ status: "accepted", action: "check_out", hasOpenVisit: false, name: "" })).toEqual({
      ok: false,
      error: "Check in before checking out.",
    });
  });

  it("closes check-in when the work order is completed or cancelled", () => {
    expect(workOrderClosedMessage("completed")).toBe("This work order is completed. On-site check-in is closed.");
    expect(workOrderClosedMessage("cancelled")).toBe("This work order is cancelled. On-site check-in is closed.");
    expect(decideSiteAction({ status: "completed", action: "check_in", hasOpenVisit: false, name: "Riley Example" }).ok).toBe(false);
    expect(decideSiteAction({ status: "cancelled", action: "check_out", hasOpenVisit: false, name: "" })).toEqual({
      ok: false,
      error: "This work order is cancelled. On-site check-in is closed.",
    });
  });

  it("stops check-out as well once the work order is completed or cancelled", () => {
    expect(decideSiteAction({ status: "completed", action: "check_out", hasOpenVisit: true, name: "" })).toEqual({
      ok: false,
      error: "This work order is completed. On-site check-in is closed.",
    });
    expect(decideSiteAction({ status: "cancelled", action: "check_in", hasOpenVisit: true, name: "Riley Example" })).toEqual({
      ok: false,
      error: "This work order is cancelled. On-site check-in is closed.",
    });
    expect(workOrderClosedMessage("completed")).toBe("This work order is completed. On-site check-in is closed.");
    expect(workOrderClosedMessage("new")).toBeNull();
  });

  it("asks for a name and limits its length", () => {
    expect(decideSiteAction({ status: "new", action: "check_in", hasOpenVisit: false, name: "  " })).toEqual({
      ok: false,
      error: "Enter your name.",
    });
    expect(decideSiteAction({ status: "new", action: "check_in", hasOpenVisit: false, name: "R".repeat(121) }).ok).toBe(false);
  });
});

describe("optional location", () => {
  it("keeps a real coordinate and ignores anything else", () => {
    expect(optionalLocation("-33.8688", "151.2093")).toEqual({ latitude: -33.8688, longitude: 151.2093 });
    expect(optionalLocation("", "")).toBeNull();
    expect(optionalLocation("nope", "151")).toBeNull();
    expect(optionalLocation("91", "0")).toBeNull();
    expect(optionalLocation("-33", "")).toBeNull();
  });

  it("formats a saved coordinate", () => {
    expect(formatLocation(-33.8688, 151.2093)).toBe("-33.86880, 151.20930");
    expect(formatLocation(null, 151)).toBeNull();
  });
});

describe("time on site", () => {
  const start = new Date("2026-11-18T23:00:00.000Z");

  it("describes the duration", () => {
    expect(formatDuration(start, new Date(start.getTime() + 20_000))).toBe("Under 1 minute");
    expect(formatDuration(start, new Date(start.getTime() + 45 * 60_000))).toBe("45m");
    expect(formatDuration(start, new Date(start.getTime() + 60 * 60_000))).toBe("1h");
    expect(formatDuration(start, new Date(start.getTime() + 75 * 60_000))).toBe("1h 15m");
  });

  it("writes check-in and check-out activity", () => {
    const lines = siteVisitActivity([
      {
        id: "wo-1",
        suffix: "A",
        caseNumber: 300,
        visits: [
          {
            id: "visit-1",
            contractorName: "Avery Sample",
            checkedInAt: start,
            checkedOutAt: new Date(start.getTime() + 75 * 60_000),
          },
        ],
      },
    ]);
    expect(lines.map((line) => line.summary)).toEqual([
      "Checked in to work order 300-A.",
      "Checked out of work order 300-A after 1h 15m.",
    ]);
    expect(lines[0]?.actorName).toBe("Avery Sample");
    expect(lines[0]?.href).toBe("/work-orders/wo-1");
  });
});
