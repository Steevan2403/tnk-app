import { getCompanySettings } from "@/lib/company-settings";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { canEditWorkOrderTerms } from "@/lib/roles";
import { contentDisposition } from "@/lib/storage";
import { buildWorkOrderPdf } from "@/lib/work-order-pdf";
import { previewWorkOrderInput } from "@/lib/work-order-preview";

export async function GET() {
  const user = await requireUser();
  if (!canEditWorkOrderTerms(user.role)) {
    return new Response("You do not have permission to edit work order terms.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const settings = await getCompanySettings();
  const building = user.selectedBuildingId
    ? await prisma.building.findUnique({
        where: { id: user.selectedBuildingId },
        select: {
          name: true,
          address: true,
          suburb: true,
          state: true,
          postcode: true,
          strataPlan: true,
          siteContactName: true,
          siteContactMobile: true,
          siteContactEmail: true,
        },
      })
    : null;
  const bytes = await buildWorkOrderPdf(previewWorkOrderInput(settings, building));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("work-order-preview.pdf", true),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
