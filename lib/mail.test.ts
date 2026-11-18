import { describe, expect, it } from "vitest";
import { deliverMail, mailTransport, type SavedMail } from "./mail";

describe("outbox mail", () => {
  it("records the recipient, subject, body, and attachment names and does not use SMTP", async () => {
    const saved: SavedMail[] = [];
    let smtpCalled = false;
    const result = await deliverMail(
      {
        to: "avery.sample@example.com",
        subject: "Work order 6-A: Example noise complaint",
        body: "Please attend the example apartment.",
        attachments: [{ name: "work-order-6-A.pdf", storedName: `${"a".repeat(32)}.pdf` }],
        workOrderId: "wo_1",
      },
      {
        mailbox: {
          async save(mail) {
            saved.push(mail);
            return { id: "mail_1" };
          },
        },
        smtp: async () => {
          smtpCalled = true;
        },
        env: {},
      },
    );

    expect(result.id).toBe("mail_1");
    expect(smtpCalled).toBe(false);
    expect(saved).toEqual([
      {
        to: "avery.sample@example.com",
        subject: "Work order 6-A: Example noise complaint",
        body: "Please attend the example apartment.",
        attachmentNames: ["work-order-6-A.pdf"],
        attachments: [{ name: "work-order-6-A.pdf", storedName: `${"a".repeat(32)}.pdf` }],
        workOrderId: "wo_1",
      },
    ]);
  });

  it("keeps SMTP off unless the host and from address are set", () => {
    expect(mailTransport({})).toBe("outbox");
    expect(mailTransport({ MAIL_TRANSPORT: "smtp" })).toBe("outbox");
    expect(mailTransport({ MAIL_TRANSPORT: "smtp", SMTP_HOST: "localhost" })).toBe("outbox");
    expect(
      mailTransport({ MAIL_TRANSPORT: "smtp", SMTP_HOST: "localhost", SMTP_FROM: "work-orders@example.com" }),
    ).toBe("smtp");
  });
});
