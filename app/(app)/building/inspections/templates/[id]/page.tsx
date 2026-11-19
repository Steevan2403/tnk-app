import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteInspectionTemplate, duplicateTemplate } from "@/app/actions/inspections";
import { deleteConfirmButtonClass, DeleteConfirm } from "@/components/delete-confirm";
import { InspectionTemplateForm } from "@/components/inspection-template-form";
import { requireUser } from "@/lib/data";
import { getTemplate, templateRunCounts } from "@/lib/inspection-data";
import { templateDeletePrompt } from "@/lib/inspections";
import { canManageInspectionTemplates } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit inspection template" };

export default async function EditInspectionTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageInspectionTemplates(user.role) || !user.selectedBuildingId) redirect("/building/inspections");
  const template = await getTemplate(user.selectedBuildingId, (await params).id);
  if (!template) notFound();
  const counts = await templateRunCounts(user.selectedBuildingId, template.id);
  const prompt = templateDeletePrompt({ name: template.name, ...counts });

  return (
    <section>
      <Link href="/building/inspections" className="text-sm text-brand-blue hover:underline">
        Inspections
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Edit template</h1>
        <form action={duplicateTemplate}>
          <input type="hidden" name="id" value={template.id} />
          <button type="submit" className="rounded-md bg-white px-4 py-2 text-sm ring-1 ring-line hover:bg-page">
            Duplicate template
          </button>
        </form>
      </div>
      <InspectionTemplateForm
        template={{
          id: template.id,
          name: template.name,
          type: template.type,
          description: template.description,
          areas: template.areas.map((area) => ({
            id: area.id,
            name: area.name,
            items: area.items.map((item) => ({ id: item.id, name: item.name, guidance: item.guidance })),
          })),
        }}
      />
      <div className="mt-8 max-w-3xl">
        <DeleteConfirm label="Delete" title={prompt.title} message={prompt.message}>
          <form action={deleteInspectionTemplate}>
            <input type="hidden" name="id" value={template.id} />
            <button type="submit" className={deleteConfirmButtonClass}>
              Delete template
            </button>
          </form>
        </DeleteConfirm>
      </div>
    </section>
  );
}
