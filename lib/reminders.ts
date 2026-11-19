import { Prisma } from "@prisma/client";
import { deliverMail } from "./mail";
import {
  asOccurrenceState,
  dueReminders,
  reminderRecipients,
  scheduleOf,
  sydneyToday,
  type DueReminder,
  type StoredOccurrence,
} from "./maintenance";
import { prisma } from "./db";
import { mailboxFor } from "./work-order-draft";

export async function sendDueReminders(now = new Date()): Promise<{ sent: number }> {
  const today = sydneyToday(now);
  const records = await prisma.maintenanceEvent.findMany({
    where: { remindContractor: true },
    include: {
      building: { select: { name: true } },
      occurrences: { select: { occursOn: true, state: true } },
      reminders: { select: { occursOn: true } },
      companies: { include: { company: { select: { email: true } } } },
      contacts: { include: { contact: { select: { email: true } } } },
    },
  });

  const due = dueReminders(
    records.flatMap((record) => {
      const schedule = scheduleOf(record);
      if (!schedule) return [];
      return [
        {
          id: record.id,
          subject: record.subject,
          buildingName: record.building.name,
          description: record.description,
          reminderDays: record.reminderDays,
          remindContractor: record.remindContractor,
          schedule,
          records: record.occurrences.map(stored),
          emails: reminderRecipients(
            record.contacts.map((link) => link.contact.email),
            record.companies.map((link) => link.company.email),
          ),
        },
      ];
    }),
    records.flatMap((record) =>
      record.reminders.map((reminder) => ({
        eventId: record.id,
        occursOn: reminder.occursOn.toISOString().slice(0, 10),
      })),
    ),
    today,
  );

  let sent = 0;
  for (const reminder of due) {
    if (await sendReminder(reminder)) sent += 1;
  }
  return { sent };
}

async function sendReminder(reminder: DueReminder): Promise<boolean> {
  const occursOn = new Date(`${reminder.occursOn}T00:00:00.000Z`);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceReminder.create({
        data: { eventId: reminder.eventId, occursOn },
      });
      for (const to of reminder.to) {
        await deliverMail(
          { to, subject: reminder.subject, body: reminder.body, attachments: [] },
          { mailbox: mailboxFor(tx) },
        );
      }
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}

function stored(record: { occursOn: Date; state: string }): StoredOccurrence {
  return { occursOn: record.occursOn, state: asOccurrenceState(record.state) };
}
