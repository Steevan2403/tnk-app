import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/reminders";

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueReminders();
  return Response.json(result);
}

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  if (provided.length === 0 || provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
