import { contentTypeFor, readStoredFile } from "./storage";

export type MailAttachment = {
  name: string;
  storedName: string;
};

// 10 MB of file bytes. That stays under a typical mailbox limit once the message is encoded.
export const EMAIL_ATTACHMENT_BUDGET = 10 * 1024 * 1024;

export type MailFile = {
  id: string;
  name: string;
  storedName: string;
  size: number | null;
};

// The PDF is always included. Later files are added while they fit, and the rest are returned to be linked.
export function packEmailAttachments(
  pdf: { name: string; storedName: string; size: number },
  files: MailFile[],
  budget = EMAIL_ATTACHMENT_BUDGET,
): { attachments: MailAttachment[]; omitted: MailFile[] } {
  const attachments: MailAttachment[] = [{ name: pdf.name, storedName: pdf.storedName }];
  let used = pdf.size > 0 ? pdf.size : 0;
  const omitted: MailFile[] = [];
  for (const file of files) {
    if (file.size != null && file.size >= 0 && used + file.size <= budget) {
      attachments.push({ name: file.name, storedName: file.storedName });
      used += file.size;
    } else {
      omitted.push(file);
    }
  }
  return { attachments, omitted };
}

export type OutgoingMail = {
  to: string;
  subject: string;
  body: string;
  attachments: MailAttachment[];
  workOrderId?: string;
  buildingId?: string;
};

export type SavedMail = {
  to: string;
  subject: string;
  body: string;
  attachmentNames: string[];
  attachments: MailAttachment[];
  workOrderId?: string;
  buildingId?: string;
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
    ...(mail.buildingId ? { buildingId: mail.buildingId } : {}),
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
