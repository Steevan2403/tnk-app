import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { canViewOutbox } from "@/lib/roles";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canViewOutbox(user.role)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const attachment = await prisma.outboxAttachment.findUnique({
    where: { id },
    select: { name: true, storedName: true },
  });
  if (!attachment) return new Response("Not found", { status: 404 });
  const bytes = await readStoredFile(attachment.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });
  const inline = contentTypeFor(attachment.storedName) === "application/pdf";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(attachment.storedName),
      "Content-Disposition": contentDisposition(attachment.name, inline),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
