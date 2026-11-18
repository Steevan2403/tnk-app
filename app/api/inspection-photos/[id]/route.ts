import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) return new Response("Not found", { status: 404 });

  const photo = await prisma.inspectionPhoto.findFirst({
    where: { id, item: { area: { run: { buildingId: user.selectedBuildingId } } } },
    select: { name: true, storedName: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });
  const bytes = await readStoredFile(photo.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(photo.storedName),
      "Content-Disposition": contentDisposition(photo.name, true),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
