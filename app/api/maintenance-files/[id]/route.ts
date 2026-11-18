import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) return new Response("Not found", { status: 404 });

  const file = await prisma.maintenanceFile.findFirst({
    where: { id, event: { buildingId: user.selectedBuildingId } },
    select: { name: true, storedName: true, kind: true },
  });
  if (!file) return new Response("Not found", { status: 404 });
  const bytes = await readStoredFile(file.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(file.storedName),
      "Content-Disposition": contentDisposition(file.name, file.kind === "photo"),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
