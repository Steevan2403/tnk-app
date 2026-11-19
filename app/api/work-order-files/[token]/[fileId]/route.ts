import { isCheckInToken } from "@/lib/check-in";
import { prisma } from "@/lib/db";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

// Public download for a file linked from a work order email. The check-in token is the secret.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  if (!isCheckInToken(token)) return new Response("Not found", { status: 404 });

  const link = await prisma.workOrderFile.findFirst({
    where: { caseFileId: fileId, workOrder: { checkInToken: token } },
    select: { caseFile: { select: { name: true, storedName: true, kind: true } } },
  });
  if (!link) return new Response("Not found", { status: 404 });

  const bytes = await readStoredFile(link.caseFile.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });

  const inline = link.caseFile.kind === "photo" || link.caseFile.kind === "video";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(link.caseFile.storedName),
      "Content-Disposition": contentDisposition(link.caseFile.name, inline),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
