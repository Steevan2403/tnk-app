import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { contentDisposition, readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) return new Response("Not found", { status: 404 });

  const record = await prisma.workOrder.findFirst({
    where: { id, case: { buildingId: user.selectedBuildingId } },
    select: { pdfName: true, pdfStoredName: true },
  });
  if (!record) return new Response("Not found", { status: 404 });
  const bytes = await readStoredFile(record.pdfStoredName);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(record.pdfName, true),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
