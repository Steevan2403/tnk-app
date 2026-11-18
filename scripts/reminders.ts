import { sendDueReminders } from "../lib/reminders";

sendDueReminders()
  .then((result) => {
    const label = result.sent === 1 ? "reminder" : "reminders";
    console.log(`Queued ${result.sent} maintenance ${label}.`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
