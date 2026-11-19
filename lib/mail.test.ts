import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deliverMail,
  EMAIL_ATTACHMENT_BUDGET,
  mailTransport,
  packEmailAttachments,
  sendSmtp,
  type OutgoingMail,
  type SavedMail,
} from "./mail";
import { uploadDir } from "./storage";

const sentMessages: { attachments?: { filename: string; content: Buffer; contentType?: string }[] }[] = [];

vi.mock("nodemailer", () => ({
  createTransport: () => ({
    async sendMail(message: { attachments?: { filename: string; content: Buffer; contentType?: string }[] }) {
      sentMessages.push(message);
    },
  }),
}));

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

  it("passes every attachment to SMTP when that transport is on", async () => {
    const attachments = [
      { name: "work-order-6-A.pdf", storedName: `${"a".repeat(32)}.pdf` },
      { name: "pump.png", storedName: `${"b".repeat(32)}.png` },
    ];
    const received: OutgoingMail[] = [];
    await deliverMail(
      {
        to: "avery.sample@example.com",
        subject: "Work order 6-A",
        body: "Please attend.",
        attachments,
      },
      {
        mailbox: {
          async save() {
            return { id: "mail_2" };
          },
        },
        smtp: async (mail) => {
          received.push(mail);
        },
        env: { MAIL_TRANSPORT: "smtp", SMTP_HOST: "localhost", SMTP_FROM: "work-orders@example.com" },
      },
    );
    expect(received[0]?.attachments).toEqual(attachments);
  });
});

describe("email attachment budget", () => {
  const pdf = { name: "work-order-305-A.pdf", storedName: `${"a".repeat(32)}.pdf`, size: 200_000 };
  const photo = { id: "photo", name: "pump.png", storedName: `${"b".repeat(32)}.png`, size: 80_000 };
  const note = { id: "note", name: "example-note.txt", storedName: `${"c".repeat(32)}.txt`, size: 400 };

  it("attaches the PDF and the files that fit, including photos", () => {
    const packed = packEmailAttachments(pdf, [photo, note]);
    expect(packed.attachments.map((file) => file.name)).toEqual([
      "work-order-305-A.pdf",
      "pump.png",
      "example-note.txt",
    ]);
    expect(packed.omitted).toEqual([]);
  });

  it("keeps the PDF, skips a file that does not fit, and still attaches a later smaller file", () => {
    const large = { id: "large", name: "example-large.txt", storedName: `${"d".repeat(32)}.txt`, size: EMAIL_ATTACHMENT_BUDGET };
    const packed = packEmailAttachments(pdf, [large, photo]);
    expect(packed.attachments.map((file) => file.name)).toEqual(["work-order-305-A.pdf", "pump.png"]);
    expect(packed.omitted.map((file) => file.name)).toEqual(["example-large.txt"]);
  });

  it("omits a file whose size is unknown and still attaches the PDF when the PDF itself is over the budget", () => {
    const missing = { id: "missing", name: "gone.pdf", storedName: `${"e".repeat(32)}.pdf`, size: null };
    const packed = packEmailAttachments({ ...pdf, size: EMAIL_ATTACHMENT_BUDGET + 1 }, [photo, missing], EMAIL_ATTACHMENT_BUDGET);
    expect(packed.attachments.map((file) => file.name)).toEqual(["work-order-305-A.pdf"]);
    expect(packed.omitted.map((file) => file.id)).toEqual(["photo", "missing"]);
  });
});

describe("SMTP attachments", () => {
  const storedName = `${"f".repeat(32)}.txt`;

  afterEach(async () => {
    sentMessages.length = 0;
    await rm(path.join(uploadDir(), storedName), { force: true });
  });

  it("sends the stored file bytes and skips a file that is missing", async () => {
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(path.join(uploadDir(), storedName), "example note");
    await sendSmtp(
      {
        to: "avery.sample@example.com",
        subject: "Work order 305-A",
        body: "Please attend.",
        attachments: [
          { name: "example-note.txt", storedName },
          { name: "missing.txt", storedName: `${"9".repeat(32)}.txt` },
        ],
      },
      { SMTP_HOST: "localhost", SMTP_FROM: "work-orders@example.com" },
    );
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.attachments).toEqual([
      {
        filename: "example-note.txt",
        content: Buffer.from("example note"),
        contentType: "text/plain",
      },
    ]);
  });
});
