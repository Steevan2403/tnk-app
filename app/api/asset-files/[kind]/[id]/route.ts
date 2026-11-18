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
  if (kind === "photos") {
    const photo = await prisma.assetPhoto.findFirst({
      where: { id, asset: { buildingId } },
      select: { name: true, storedName: true },
    });
    return photo ? { ...photo, inline: true } : null;
  }
  if (kind === "documents") {
    const document = await prisma.assetDocument.findFirst({
      where: { id, asset: { buildingId } },
      select: { name: true, storedName: true },
    });
    return document ? { ...document, inline: false } : null;
  }
  return null;
}
