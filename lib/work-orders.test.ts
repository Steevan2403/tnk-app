import { describe, expect, it } from "vitest";
import {
  contactEmail,
  defaultWorkOrderSubject,
  nextWorkOrderSuffix,
  parseWorkOrderForm,
  resolveWorkOrderContact,
  suffixFromRank,
  sydneyDateTimeToUtc,
  formatFileSize,
  omittedAttachmentNotice,
  workOrderEmailBody,
  type WorkOrderFormContext,
} from "./work-orders";

const companies = [
  {
    id: "fire",
    approved: true,
    assigned: true,
    contacts: [
      { id: "avery", email: "avery.sample@example.com" },
      { id: "blank", email: "  " },
    ],
  },
  {
    id: "pending",
    approved: false,
    assigned: false,
    contacts: [{ id: "riley", email: "riley.demo@example.com" }],
  },
  {
    id: "assigned-pending",
    approved: false,
    assigned: true,
    contacts: [{ id: "riley", email: "riley.demo@example.com" }],
  },
  {
    id: "plumbing",
    approved: true,
    assigned: false,
    contacts: [{ id: "casey", email: "casey.placeholder@example.com" }],
  },
];

const context: WorkOrderFormContext = {
  companies,
  fileIds: ["photo-1"],
};

describe("work order letters", () => {
  it("letters A through Z and then AA", () => {
    expect(suffixFromRank(1)).toBe("A");
    expect(suffixFromRank(2)).toBe("B");
    expect(suffixFromRank(26)).toBe("Z");
    expect(suffixFromRank(27)).toBe("AA");
    expect(suffixFromRank(28)).toBe("AB");
  });

  it("takes the next letter after the highest one already used", () => {
    expect(nextWorkOrderSuffix([])).toBe("A");
    expect(nextWorkOrderSuffix(["A"])).toBe("B");
    expect(nextWorkOrderSuffix(["A", "B"])).toBe("C");
    expect(nextWorkOrderSuffix(["Z"])).toBe("AA");
    expect(nextWorkOrderSuffix(["A", "Z"])).toBe("AA");
    expect(nextWorkOrderSuffix(["AA"])).toBe("AB");
  });
});

describe("work order contacts", () => {
  it("accepts a contact who belongs to the chosen company and has an email", () => {
    expect(resolveWorkOrderContact("fire", "avery", companies)?.email).toBe("avery.sample@example.com");
    expect(resolveWorkOrderContact("plumbing", "casey", companies)?.email).toBe("casey.placeholder@example.com");
    expect(resolveWorkOrderContact("assigned-pending", "riley", companies)?.email).toBe("riley.demo@example.com");
  });

  it("rejects a contact from another company, a contact without an email, and an unassigned pending company", () => {
    expect(resolveWorkOrderContact("fire", "casey", companies)).toBeNull();
    expect(resolveWorkOrderContact("plumbing", "avery", companies)).toBeNull();
    expect(resolveWorkOrderContact("fire", "blank", companies)).toBeNull();
    expect(resolveWorkOrderContact("pending", "riley", companies)).toBeNull();
    expect(contactEmail("not-an-email")).toBeNull();
  });

  it("rejects the form when the contact is not on that company", () => {
    const data = new FormData();
    data.set("companyId", "fire");
    data.set("contactId", "casey");
    data.set("subject", defaultWorkOrderSubject(6, "A", "Example noise"));
    data.set("message", "Example instructions.");
    const parsed = parseWorkOrderForm(data, context);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.contactId).toBe("Choose a contact of that company with an email.");
  });

  it("rejects the form when no contact is chosen", () => {
    const data = new FormData();
    data.set("companyId", "plumbing");
    data.set("subject", "Example subject");
    data.set("message", "Example instructions.");
    const parsed = parseWorkOrderForm(data, context);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.contactId).toBe("Choose a contact of that company with an email.");
  });

  it("rejects a contact who has no email", () => {
    const data = new FormData();
    data.set("companyId", "fire");
    data.set("contactId", "blank");
    data.set("subject", "Example subject");
    const parsed = parseWorkOrderForm(data, context);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.contactId).toBe("Choose a contact of that company with an email.");
  });

  it("accepts a contact of that company who has an email", () => {
    const data = new FormData();
    data.set("companyId", "plumbing");
    data.set("contactId", "casey");
    data.set("subject", "Example subject");
    data.set("message", "Example instructions.");
    const parsed = parseWorkOrderForm(data, context);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.contactId).toBe("casey");
      expect(parsed.value.contactEmail).toBe("casey.placeholder@example.com");
      expect(parsed.value.subject).toBe("Example subject");
      expect(parsed.value.message).toBe("Example instructions.");
    }
  });
});

describe("file sizes", () => {
  it("uses bytes, kilobytes, and megabytes", () => {
    expect(formatFileSize(null)).toBe("unknown size");
    expect(formatFileSize(-1)).toBe("unknown size");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });
});

describe("work order email", () => {
  it("includes the on-site check-in link", () => {
    const body = workOrderEmailBody({
      number: "300-A",
      buildingName: "Example Tower",
      companyName: "Fictional Fire Services",
      contactName: "Avery Sample",
      message: "Example instructions.",
      pdfName: "work-order-300-A.pdf",
      checkInUrl: "https://app.example/check-in/seed-check-in-300-a-example",
    });
    expect(body).toContain("On-site check-in: https://app.example/check-in/seed-check-in-300-a-example");
    expect(body).toContain("The work order is attached as work-order-300-A.pdf.");
    expect(body).not.toContain("too large to attach");
  });

  it("lists files that did not fit, with a download link", () => {
    const body = workOrderEmailBody({
      number: "305-A",
      buildingName: "Example Tower",
      companyName: "Fictional Fire Services",
      contactName: "Avery Sample",
      message: "Example instructions.",
      pdfName: "work-order-305-A.pdf",
      checkInUrl: "https://app.example/check-in/token",
      omitted: [
        {
          name: "example-large.txt",
          size: 10 * 1024 * 1024,
          url: "https://app.example/api/work-order-files/token/file-1",
        },
      ],
    });
    expect(body).toContain("These files were too large to attach:");
    expect(body).toContain("example-large.txt (10 MB)");
    expect(body).toContain("https://app.example/api/work-order-files/token/file-1");
  });

  it("tells the sender which files were linked instead of attached", () => {
    expect(omittedAttachmentNotice("305-A", ["example-large.txt"])).toBe(
      "Work order 305-A was sent. example-large.txt was too large to attach and is linked in the email.",
    );
    expect(omittedAttachmentNotice("305-A", ["clip.mp4", "scan.pdf"])).toBe(
      "Work order 305-A was sent. These files were too large to attach and are linked in the email: clip.mp4, scan.pdf.",
    );
    expect(omittedAttachmentNotice("305-A", [])).toBeNull();
    expect(omittedAttachmentNotice("", ["clip.mp4"])).toBeNull();
  });
});

describe("Sydney date and time", () => {
  it("stores a Sydney wall time as UTC", () => {
    expect(sydneyDateTimeToUtc("2026-11-18T09:00")?.toISOString()).toBe("2026-11-17T22:00:00.000Z");
    expect(sydneyDateTimeToUtc("2026-11-18")).toBeNull();
  });
});
