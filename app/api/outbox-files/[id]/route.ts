import { getOutboxAttachment, requireUser } from "@/lib/data";
import { canViewOutbox } from "@/lib/roles";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canViewOutbox(user.role)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const attachment = await getOutboxAttachment(user, id);
  if (!attachment) return new Response("Not found", { status: 404 });
  const bytes = await readStoredFile(attachment.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });
  const type = contentTypeFor(attachment.storedName);
  const inline = type === "application/pdf" || type.startsWith("image/") || type.startsWith("video/");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": contentDisposition(attachment.name, inline),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
