import { requireUser } from "@/lib/data";
import { inspectionPdfInput } from "@/lib/inspection-data";
import { buildInspectionPdf } from "@/lib/inspection-pdf";
import { inspectionPdfName } from "@/lib/inspections";
import { contentDisposition } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) return new Response("Not found", { status: 404 });

  const input = await inspectionPdfInput(user.selectedBuildingId, id);
  if (!input) return new Response("Not found", { status: 404 });
  const bytes = await buildInspectionPdf(input);
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(inspectionPdfName(input.name), !download),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
