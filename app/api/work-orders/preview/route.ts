import { prepareWorkOrderDraft, toPdfInput, workOrderPhotoBytes } from "@/lib/work-order-draft";
import { buildWorkOrderPdf } from "@/lib/work-order-pdf";
import { requireUser } from "@/lib/data";
import { canSendWorkOrders } from "@/lib/roles";
import { contentDisposition } from "@/lib/storage";
import { workOrderLinks } from "@/lib/work-order-terms";
import { subjectForSuffix, workOrderPdfName } from "@/lib/work-orders";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canSendWorkOrders(user.role) || !user.selectedBuildingId) {
    return new Response("You do not have permission to send work orders.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const prepared = await prepareWorkOrderDraft(user.selectedBuildingId, await request.formData());
  if (!prepared.ok) {
    const message = prepared.error ?? Object.values(prepared.errors ?? {})[0] ?? "Check the work order and try again.";
    return new Response(message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const draft = prepared.draft;
  const subject = subjectForSuffix(draft.subject, draft.caseNumber, draft.previewSuffix, draft.previewSuffix, draft.caseSubject);
  const photos = await workOrderPhotoBytes(draft.files);
  const bytes = await buildWorkOrderPdf(
    toPdfInput({ ...draft, subject }, draft.previewSuffix, workOrderLinks("preview"), photos),
  );
  const name = workOrderPdfName(draft.caseNumber, draft.previewSuffix);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(name, true),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
