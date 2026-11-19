import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await requireUser();
  const { kind, id } = await params;
  if (!user.selectedBuildingId) return new Response("Not found", { status: 404 });

  const file = await findFile(kind, id, user.selectedBuildingId);
  if (!file) return new Response("Not found", { status: 404 });

  const bytes = await readStoredFile(file.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(file.storedName),
      "Content-Disposition": contentDisposition(file.name, file.inline),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function findFile(
  kind: string,
  id: string,
  buildingId: string,
): Promise<{ name: string; storedName: string; inline: boolean } | null> {
  if (kind === "documents") {
    const document = await prisma.apartmentDocument.findFirst({
      where: { id, apartment: { buildingId } },
      select: { name: true, storedName: true },
    });
    return document ? { ...document, inline: false } : null;
  }
  if (kind === "images") {
    const image = await prisma.apartmentImage.findFirst({
      where: { id, apartment: { buildingId } },
      select: { name: true, storedName: true },
    });
    return image ? { ...image, inline: true } : null;
  }
  if (kind === "vehicles") {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, apartment: { buildingId } },
      select: { photoName: true, photoStoredName: true },
    });
    if (!vehicle?.photoName || !vehicle.photoStoredName) return null;
    return { name: vehicle.photoName, storedName: vehicle.photoStoredName, inline: true };
  }
  return null;
}
