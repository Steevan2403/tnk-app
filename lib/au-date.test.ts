import { describe, expect, it } from "vitest";
import { formatAuDate, formatAuDateTime, parseAuDate, parseAuDateTime } from "./au-date";

describe("Australian dates", () => {
  it("reads a day-month-year date and an ISO date as the same day", () => {
    expect(parseAuDate("19/11/2026")).toBe("2026-11-19");
    expect(parseAuDate("2026-11-19")).toBe("2026-11-19");
    expect(parseAuDate("1/2/2026")).toBe("2026-02-01");
    expect(formatAuDate("2026-11-19")).toBe("19/11/2026");
    expect(formatAuDate("19/11/2026")).toBe("19/11/2026");
  });

  it("rejects a day that the month does not have", () => {
    expect(parseAuDate("31/02/2026")).toBeNull();
    expect(parseAuDate("19-11-2026")).toBeNull();
    expect(parseAuDate("")).toBeNull();
  });

  it("reads a day-month-year time and keeps the ISO form for the form post", () => {
    expect(parseAuDateTime("19/11/2026 09:30")).toBe("2026-11-19T09:30");
    expect(parseAuDateTime("2026-11-19T09:30")).toBe("2026-11-19T09:30");
    expect(formatAuDateTime("2026-11-19T14:05")).toBe("19/11/2026 14:05");
    expect(parseAuDateTime("19/11/2026 25:00")).toBeNull();
  });
});
