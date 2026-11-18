import { contentTypeFor, readStoredFile } from "./storage";

export type MailAttachment = {
  name: string;
  storedName: string;
};

export type OutgoingMail = {
  to: string;
  subject: string;
  body: string;
  attachments: MailAttachment[];
  workOrderId?: string;
};

export type SavedMail = {
  to: string;
  subject: string;
  body: string;
  attachmentNames: string[];
  attachments: MailAttachment[];
  workOrderId?: string;
};

export type Mailbox = {
  save(mail: SavedMail): Promise<{ id: string }>;
};

type SmtpSend = (mail: OutgoingMail) => Promise<void>;

// Outbox unless MAIL_TRANSPORT=smtp and both SMTP_HOST and SMTP_FROM are set.
export function mailTransport(env: Record<string, string | undefined> = process.env): "outbox" | "smtp" {
  if (env.MAIL_TRANSPORT !== "smtp") return "outbox";
  if (!env.SMTP_HOST?.trim() || !env.SMTP_FROM?.trim()) return "outbox";
  return "smtp";
}

export async function deliverMail(
  mail: OutgoingMail,
  options: { mailbox: Mailbox; smtp?: SmtpSend; env?: Record<string, string | undefined> },
): Promise<{ id: string }> {
  const saved = await options.mailbox.save({
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    attachmentNames: mail.attachments.map((attachment) => attachment.name),
    attachments: mail.attachments,
    workOrderId: mail.workOrderId,
  });
  if (mailTransport(options.env ?? process.env) === "smtp") {
    await (options.smtp ?? sendSmtp)(mail);
  }
  return saved;
}

// Used only when mailTransport() is smtp. The default path never calls this.
export async function sendSmtp(mail: OutgoingMail, env: Record<string, string | undefined> = process.env): Promise<void> {
  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  if (!host || !from) return;
  const nodemailer = await import("nodemailer");
  const createTransport = nodemailer.createTransport;
  if (!createTransport) throw new Error("SMTP transport is unavailable.");
  const user = env.SMTP_USER?.trim();
  const transporter = createTransport({
    host,
    port: Number(env.SMTP_PORT ?? 587),
    secure: env.SMTP_SECURE === "true",
    auth: user ? { user, pass: env.SMTP_PASS ?? "" } : undefined,
  });
  const attachments = [];
  for (const attachment of mail.attachments) {
    const bytes = await readStoredFile(attachment.storedName);
    if (!bytes) continue;
    attachments.push({
      filename: attachment.name,
      content: bytes,
      contentType: contentTypeFor(attachment.storedName),
    });
  }
  await transporter.sendMail({
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.body,
    attachments,
  });
}
