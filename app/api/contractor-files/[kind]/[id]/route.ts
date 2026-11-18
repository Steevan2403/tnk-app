import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { contentDisposition, contentTypeFor, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  await requireUser();
  const { kind, id } = await params;
  const file = await findFile(kind, id);
  if (!file) return new Response("Not found", { status: 404 });

  const bytes = await readStoredFile(file.storedName);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(file.storedName),
      "Content-Disposition": contentDisposition(file.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function findFile(kind: string, id: string): Promise<{ name: string; storedName: string } | null> {
  if (kind === "documents") {
    return prisma.contractorDocument.findUnique({
      where: { id },
      select: { name: true, storedName: true },
    });
  }
  if (kind === "certificates") {
    const insurance = await prisma.contractorInsurance.findUnique({
      where: { id },
      select: { certificateName: true, certificateStoredName: true },
    });
    if (!insurance?.certificateName || !insurance.certificateStoredName) return null;
    return { name: insurance.certificateName, storedName: insurance.certificateStoredName };
  }
  return null;
}
