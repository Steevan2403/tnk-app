import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) return new Response("Not found", { status: 404 });

  const record = await prisma.maintenanceOccurrence.findFirst({
    where: { id, event: { buildingId: user.selectedBuildingId } },
    select: { fileName: true, fileStoredName: true },
  });
  if (!record?.fileName || !record.fileStoredName) return new Response("Not found", { status: 404 });
  const bytes = await readStoredFile(record.fileStoredName);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(record.fileStoredName),
      "Content-Disposition": contentDisposition(record.fileName, false),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
